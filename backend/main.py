import os
import time
import secrets
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from db import get_conn
from auth import verify_token, require_admin, require_super_admin, check_password, make_token, hash_password
from email_utils import send_invite_email, send_reset_email, send_error_alert
from cache import cache_get, cache_set, cache_bust, cache_info

load_dotenv(Path(__file__).parent / ".env")

# ── Logging ───────────────────────────────────────────────────────────────────

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

_log_handler = RotatingFileHandler(str(LOG_FILE), maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
_log_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

log = logging.getLogger("pxp")
log.setLevel(logging.INFO)
log.addHandler(_log_handler)

# ── Rate limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="PXP Order Dashboard API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_alert_cooldown: dict = {}
_ALERT_COOLDOWN_S = 3600  # max 1 alert email per error type per hour


@app.middleware("http")
async def log_and_alert(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
        ms = round((time.time() - start) * 1000)
        level = logging.WARNING if response.status_code >= 400 else logging.INFO
        log.log(level, f"{request.method} {request.url.path} {response.status_code} ({ms}ms)")
        return response
    except Exception as exc:
        import traceback as _tb
        tb_str = _tb.format_exc()
        log.error(f"UNHANDLED {request.method} {request.url.path}\n{tb_str}")
        key = f"{type(exc).__name__}:{request.url.path}"
        now = time.time()
        if now - _alert_cooldown.get(key, 0) > _ALERT_COOLDOWN_S:
            _alert_cooldown[key] = now
            try:
                send_error_alert(request.method, str(request.url.path), tb_str)
            except Exception:
                pass
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def ensure_invite_schema():
    """Auto-apply invite columns so no manual migration step is needed."""
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            for sql in [
                "ALTER TABLE local_reference.clients MODIFY COLUMN password_hash VARCHAR(255) NULL",
                "ALTER TABLE local_reference.clients ADD COLUMN invite_token VARCHAR(100) NULL",
                "ALTER TABLE local_reference.clients ADD COLUMN invite_expires_at DATETIME NULL",
                "ALTER TABLE local_reference.clients ADD COLUMN is_super_admin TINYINT(1) NOT NULL DEFAULT 0",
            ]:
                try:
                    cur.execute(sql)
                except Exception:
                    pass  # column already exists — safe to ignore
            conn.commit()
            # Clean up expired invite tokens
            try:
                cur.execute(
                    "UPDATE local_reference.clients SET invite_token = NULL, invite_expires_at = NULL "
                    "WHERE invite_expires_at IS NOT NULL AND invite_expires_at < NOW() AND password_hash IS NULL"
                )
                conn.commit()
            except Exception:
                pass
    except Exception:
        pass  # don't crash startup if DB is temporarily unavailable
    finally:
        try:
            conn.close()
        except Exception:
            pass

# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, company_name, is_admin, is_super_admin FROM local_reference.clients WHERE email = %s",
                (body.email,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        log.warning(f"Failed login attempt for {body.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["password_hash"]:
        raise HTTPException(status_code=401, detail="Please check your email to activate your account first.")
    if not check_password(body.password, row["password_hash"]):
        log.warning(f"Failed login attempt for {body.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    is_super = bool(row.get("is_super_admin"))
    token = make_token(row["email"], row["id"], row["company_name"], bool(row["is_admin"]), is_super_admin=is_super)
    log.info(f"Login: {row['email']} ({row['company_name']})")
    return {"token": token, "company_name": row["company_name"], "is_admin": bool(row["is_admin"]), "is_super_admin": is_super}


# ── Orders ────────────────────────────────────────────────────────────────────

_ORDERS_BASE = """
SELECT
    o.ID_Order                                                              AS order_number,
    o.cn_TotalProductQty_Current                                            AS product_quantity,
    COALESCE(ot.name, CAST(o.id_OrderType AS CHAR))                         AS order_type,
    l.location_name                                                         AS pxp_location,
    TRIM(CONCAT(COALESCE(e.first_name,''), ' ', COALESCE(e.last_name,''))) AS pxp_ae,
    o.CustomerPurchaseOrder                                                 AS purchase_order,
    o.ct_ContactNameFull                                                    AS order_contact,
    od.ct_DesignName                                                        AS design_name,
    o.date_OrderPlaced                                                      AS approx_po_date,
    o.date_OrderRequestedToShip                                             AS request_to_ship_date,
    (o.cn_sts_HoldOrderGraphic = '10')                                      AS on_hold,
    (o.sts_ArtDone = 1)                                                     AS art_complete,
    (o.sts_Purchased = 1)                                                   AS purchased,
    (o.sts_Received >= 1)                                                   AS received_garments,
    (o.sts_Shipped = 1)                                                     AS shipped,
    o.date_OrderShipped                                                     AS ship_date,
    GROUP_CONCAT(DISTINCT m.ShipMethod ORDER BY m.ShipMethod SEPARATOR ', ') AS carrier,
    GROUP_CONCAT(DISTINCT ml.TrackingNumber ORDER BY ml.TrackingNumber SEPARATOR ', ') AS tracking_number,
    o.NotesToWebCustomer                                                    AS notes_to_customer,
    o.CompanyName                                                           AS customer
FROM shopworks.orders o
LEFT JOIN shopworks.orderdes od
    ON od.id_Order = o.ID_Order
LEFT JOIN shopworks.location l
    ON l.id_CompanyLocation = o.id_CompanyLocation
LEFT JOIN shopworks.employee e
    ON e.id_employee = o.id_EmpCreatedBy
LEFT JOIN local_reference.order_type ot
    ON CAST(ot.id AS UNSIGNED) = o.id_OrderType
LEFT JOIN shopworks.manifest m
    ON m.id_Order = o.ID_Order
    AND m.ShipMethod IS NOT NULL AND m.ShipMethod != ''
LEFT JOIN shopworks.manifest_lines ml
    ON ml.id_Manifest = m.ID_Manifest
    AND ml.TrackingNumber IS NOT NULL AND ml.TrackingNumber != ''
"""

# Used when a specific company must be shown
_ORDERS_SQL = _ORDERS_BASE + "WHERE o.CompanyName = %s AND o.date_OrderPlaced >= DATE_FORMAT(CURDATE(), '%%Y-01-01')\n"
# Used for super admins viewing all companies
_ORDERS_SQL_ALL = _ORDERS_BASE + "WHERE o.date_OrderPlaced >= DATE_FORMAT(CURDATE(), '%%Y-01-01')\n"

_ORDERS_GROUP_BY = """
GROUP BY
    o.ID_Order, o.cn_TotalProductQty_Current, o.id_OrderType, ot.name,
    l.location_name, e.first_name, e.last_name,
    o.CustomerPurchaseOrder, o.ct_ContactNameFull, od.ct_DesignName,
    o.date_OrderPlaced, o.date_OrderRequestedToShip,
    o.cn_sts_HoldOrderGraphic, o.sts_ArtDone, o.sts_Purchased,
    o.sts_Received, o.sts_Shipped, o.date_OrderShipped,
    o.NotesToWebCustomer, o.CompanyName
"""

_DATE_COLS = ("request_to_ship_date", "approx_po_date", "ship_date")
_BOOL_COLS = ("on_hold", "art_complete", "purchased", "received_garments", "shipped")


def _build_filter_clause(params: dict, contact_emails: list = None) -> tuple:
    clauses, args = [], []

    if contact_emails:
        placeholders = ','.join(['%s'] * len(contact_emails))
        clauses.append(f"AND o.ct_ContactNameFull IN ({placeholders})")
        args.extend(contact_emails)

    if params.get("order_number"):
        try:
            clauses.append("AND o.ID_Order = %s")
            args.append(int(params["order_number"]))
        except (ValueError, TypeError):
            pass  # ignore non-numeric order number input

    if params.get("purchase_order"):
        clauses.append("AND o.CustomerPurchaseOrder LIKE %s")
        args.append(f"%{params['purchase_order']}%")

    if params.get("order_contact"):
        clauses.append("AND o.ct_ContactNameFull LIKE %s")
        args.append(f"%{params['order_contact']}%")

    if params.get("design_name"):
        clauses.append("AND od.ct_DesignName LIKE %s")
        args.append(f"%{params['design_name']}%")

    if params.get("order_type"):
        clauses.append("AND ot.name = %s")
        args.append(params["order_type"])

    if params.get("ship_date_from"):
        clauses.append("AND o.date_OrderRequestedToShip >= %s")
        args.append(params["ship_date_from"])

    if params.get("ship_date_to"):
        clauses.append("AND o.date_OrderRequestedToShip <= %s")
        args.append(params["ship_date_to"])

    if params.get("shipped") == "yes":
        clauses.append("AND o.sts_Shipped = 1")
    elif params.get("shipped") == "no":
        clauses.append("AND o.sts_Shipped != 1")

    return " ".join(clauses), args


def _serialize_rows(rows: list) -> list:
    for row in rows:
        for col in _DATE_COLS:
            if row.get(col):
                row[col] = str(row[col])
        for col in _BOOL_COLS:
            row[col] = bool(row.get(col))
    return rows


@app.get("/api/orders")
def get_orders(
    order_number: str = None,
    purchase_order: str = None,
    order_contact: str = None,
    design_name: str = None,
    order_type: str = None,
    ship_date_from: str = None,
    ship_date_to: str = None,
    shipped: str = None,
    company_override: str = None,
    user: dict = Depends(verify_token),
):
    is_super = user.get("is_super_admin")
    # Super admin with no override = view all companies
    view_all = is_super and not company_override
    company = (company_override if is_super and company_override else None) or user["company_name"]
    client_id = user["client_id"]

    year = datetime.now().year
    cache_key = f"orders:{'ALL' if view_all else company}:{year}"
    no_filters = not any([order_number, purchase_order, order_contact, design_name, order_type, ship_date_from, ship_date_to, shipped])

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if is_super:
                contact_emails = []
            else:
                cur.execute(
                    "SELECT contact_name FROM local_reference.client_contacts WHERE client_id = %s",
                    (client_id,),
                )
                contact_emails = [r["contact_name"] for r in cur.fetchall()]

            extra_sql, extra_args = _build_filter_clause({
                "order_number": order_number,
                "purchase_order": purchase_order,
                "order_contact": order_contact,
                "design_name": design_name,
                "order_type": order_type,
                "ship_date_from": ship_date_from,
                "ship_date_to": ship_date_to,
                "shipped": shipped,
            }, contact_emails)

            # Use cache only for unfiltered requests
            if no_filters:
                cached = cache_get(cache_key)
                if cached is not None:
                    log.info(f"Cache hit: {cache_key}")
                    return {"orders": cached, "count": len(cached), "cached": True}

            if view_all:
                sql = _ORDERS_SQL_ALL + extra_sql + _ORDERS_GROUP_BY + " ORDER BY o.date_OrderRequestedToShip DESC LIMIT 3000"
                cur.execute(sql, extra_args)
            else:
                sql = _ORDERS_SQL + extra_sql + _ORDERS_GROUP_BY + " ORDER BY o.date_OrderRequestedToShip DESC LIMIT 1000"
                cur.execute(sql, [company] + extra_args)
            rows = cur.fetchall()
    finally:
        conn.close()

    rows = _serialize_rows(rows)
    if no_filters:
        cache_set(cache_key, rows)
        log.info(f"Cache set: {cache_key} ({len(rows)} rows)")
    return {"orders": rows, "count": len(rows), "cached": False}


# ── Filters ───────────────────────────────────────────────────────────────────

@app.get("/api/filters")
def get_filters(company_override: str = None, user: dict = Depends(verify_token)):
    is_super = user.get("is_super_admin")
    view_all = is_super and not company_override
    company = (company_override if is_super and company_override else None) or user["company_name"]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if view_all:
                cur.execute(
                    """
                    SELECT DISTINCT COALESCE(ot.name, CAST(o.id_OrderType AS CHAR)) AS order_type
                    FROM shopworks.orders o
                    LEFT JOIN local_reference.order_type ot ON CAST(ot.id AS UNSIGNED) = o.id_OrderType
                    WHERE ot.name IS NOT NULL
                    ORDER BY order_type
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT DISTINCT COALESCE(ot.name, CAST(o.id_OrderType AS CHAR)) AS order_type
                    FROM shopworks.orders o
                    LEFT JOIN local_reference.order_type ot ON CAST(ot.id AS UNSIGNED) = o.id_OrderType
                    WHERE o.CompanyName = %s AND ot.name IS NOT NULL
                    ORDER BY order_type
                    """,
                    (company,),
                )
            order_types = [r["order_type"] for r in cur.fetchall()]
    finally:
        conn.close()
    return {"order_types": order_types}


# ── Admin ─────────────────────────────────────────────────────────────────────

class CreateClientRequest(BaseModel):
    email: str
    password: Optional[str] = None   # None = send invite email instead
    company_name: str
    is_admin: bool = False


class SetPasswordRequest(BaseModel):
    token: str
    password: str


class UpdateClientRequest(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    company_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_super_admin: Optional[bool] = None


class AddContactRequest(BaseModel):
    contact_email: str


_CLIENTS_SELECT = """
    SELECT c.id, c.email, c.company_name, c.is_admin, c.is_super_admin,
           COUNT(cc.id) AS contact_count,
           CASE
             WHEN c.password_hash IS NOT NULL THEN 'active'
             WHEN c.invite_token IS NOT NULL AND c.invite_expires_at > NOW() THEN 'pending'
             ELSE 'expired'
           END AS invite_status
    FROM local_reference.clients c
    LEFT JOIN local_reference.client_contacts cc ON cc.client_id = c.id
"""
_CLIENTS_GROUP = """
    GROUP BY c.id, c.email, c.company_name, c.is_admin, c.password_hash, c.invite_token, c.invite_expires_at
    ORDER BY c.company_name, c.email
"""


@app.get("/api/admin/clients")
def admin_list_clients(user: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if user.get("is_super_admin"):
                cur.execute(_CLIENTS_SELECT + _CLIENTS_GROUP)
            else:
                cur.execute(_CLIENTS_SELECT + "WHERE c.company_name = %s" + _CLIENTS_GROUP, (user["company_name"],))
            clients = cur.fetchall()
            for c in clients:
                c["is_admin"] = bool(c["is_admin"])
                c["is_super_admin"] = bool(c["is_super_admin"])
            return {"clients": clients}
    finally:
        conn.close()


@app.post("/api/admin/clients", status_code=201)
def admin_create_client(body: CreateClientRequest, background_tasks: BackgroundTasks, user: dict = Depends(require_super_admin)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            try:
                if body.password:
                    # Direct creation with password (admin/test use)
                    cur.execute(
                        "INSERT INTO local_reference.clients (email, password_hash, company_name, is_admin) VALUES (%s, %s, %s, %s)",
                        (body.email, hash_password(body.password), body.company_name, int(body.is_admin)),
                    )
                    conn.commit()
                    return {"id": cur.lastrowid, "invited": False}
                else:
                    # Invite flow — no password, send email
                    token   = secrets.token_urlsafe(48)
                    expires = datetime.utcnow() + timedelta(hours=72)
                    cur.execute(
                        """INSERT INTO local_reference.clients
                           (email, password_hash, company_name, is_admin, invite_token, invite_expires_at)
                           VALUES (%s, NULL, %s, %s, %s, %s)""",
                        (body.email, body.company_name, int(body.is_admin), token, expires),
                    )
                    conn.commit()
                    new_id = cur.lastrowid
            except Exception as e:
                if "Duplicate entry" in str(e):
                    raise HTTPException(status_code=409, detail="Email already exists")
                raise

        portal_url = os.getenv("PORTAL_URL", "http://localhost:5173")
        invite_url = f"{portal_url}/set-password?token={token}"
        background_tasks.add_task(send_invite_email, body.email, body.company_name, token)
        log.info(f"Client created: {body.email} ({body.company_name}) by {user['sub']}")
        return {"id": new_id, "invited": True, "invite_url": invite_url}
    finally:
        conn.close()


@app.post("/api/admin/clients/{client_id}/resend-invite", status_code=200)
def admin_resend_invite(client_id: int, background_tasks: BackgroundTasks, user: dict = Depends(require_admin)):
    token   = secrets.token_urlsafe(48)
    expires = datetime.utcnow() + timedelta(hours=72)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email, company_name, password_hash FROM local_reference.clients WHERE id = %s",
                (client_id,),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Client not found")
        if not user.get("is_super_admin") and row["company_name"] != user["company_name"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if row["password_hash"]:
            raise HTTPException(status_code=400, detail="Client has already set their password")
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE local_reference.clients SET invite_token = %s, invite_expires_at = %s WHERE id = %s",
                (token, expires, client_id),
            )
            conn.commit()
    finally:
        conn.close()

    portal_url = os.getenv("PORTAL_URL", "http://localhost:5173")
    invite_url = f"{portal_url}/set-password?token={token}"
    background_tasks.add_task(send_invite_email, row["email"], row["company_name"], token)
    return {"ok": True, "invite_url": invite_url}


@app.get("/api/auth/invite/{token}")
def verify_invite(token: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email, company_name, invite_expires_at, password_hash FROM local_reference.clients WHERE invite_token = %s",
                (token,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=400, detail="This invite link is invalid or has already been used.")

    expires = row["invite_expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.replace(tzinfo=None) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invite link has expired. Please contact PXP for a new one.")

    return {"email": row["email"], "company_name": row["company_name"], "is_reset": bool(row["password_hash"])}


@app.post("/api/auth/set-password")
def set_password(body: SetPasswordRequest):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, company_name, invite_expires_at FROM local_reference.clients WHERE invite_token = %s",
                (body.token,),
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=400, detail="This invite link is invalid or has already been used.")

        expires = row["invite_expires_at"]
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires)
        if expires.replace(tzinfo=None) < datetime.utcnow():
            raise HTTPException(status_code=400, detail="This invite link has expired. Please contact PXP for a new one.")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE local_reference.clients SET password_hash = %s, invite_token = NULL, invite_expires_at = NULL WHERE id = %s",
                (hash_password(body.password), row["id"]),
            )
            conn.commit()
    finally:
        conn.close()

    return {"ok": True, "email": row["email"]}


@app.put("/api/admin/clients/{client_id}")
def admin_update_client(client_id: int, body: UpdateClientRequest, user: dict = Depends(require_admin)):
    is_super = user.get("is_super_admin")
    fields, args = [], []

    if body.email is not None:
        if not is_super:
            raise HTTPException(status_code=403, detail="Only PXP admins can change email")
        fields.append("email = %s"); args.append(body.email)
    if body.password is not None:
        fields.append("password_hash = %s"); args.append(hash_password(body.password))
    if body.company_name is not None:
        if not is_super:
            raise HTTPException(status_code=403, detail="Only PXP admins can change company")
        fields.append("company_name = %s"); args.append(body.company_name)
    if body.is_admin is not None:
        if not is_super:
            raise HTTPException(status_code=403, detail="Only PXP admins can change admin status")
        fields.append("is_admin = %s"); args.append(int(body.is_admin))
    if body.is_super_admin is not None:
        if not is_super:
            raise HTTPException(status_code=403, detail="Only PXP admins can assign super admin")
        # Granting super admin also ensures is_admin is set
        fields.append("is_super_admin = %s"); args.append(int(body.is_super_admin))
        if body.is_super_admin:
            fields.append("is_admin = %s"); args.append(1)

    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    # Company admins may only update clients within their own company
    if not is_super:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT company_name FROM local_reference.clients WHERE id = %s", (client_id,))
                row = cur.fetchone()
        finally:
            conn.close()
        if not row or row["company_name"] != user["company_name"]:
            raise HTTPException(status_code=403, detail="Access denied")

    args.append(client_id)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE local_reference.clients SET {', '.join(fields)} WHERE id = %s", args)
            conn.commit()
            return {"ok": True}
    finally:
        conn.close()


@app.delete("/api/admin/clients/{client_id}")
def admin_delete_client(client_id: int, user: dict = Depends(require_super_admin)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM local_reference.clients WHERE id = %s", (client_id,))
            conn.commit()
            return {"ok": True}
    finally:
        conn.close()


def _assert_client_company(client_id: int, user: dict):
    """For non-super-admins: verify the target client is in the same company."""
    if user.get("is_super_admin"):
        return
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT company_name FROM local_reference.clients WHERE id = %s", (client_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row or row["company_name"] != user["company_name"]:
        raise HTTPException(status_code=403, detail="Access denied")


@app.get("/api/admin/clients/{client_id}/contacts")
def admin_list_contacts(client_id: int, user: dict = Depends(require_admin)):
    _assert_client_company(client_id, user)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, contact_name, created_at FROM local_reference.client_contacts WHERE client_id = %s ORDER BY contact_name",
                (client_id,),
            )
            contacts = cur.fetchall()
            for c in contacts:
                if c.get("created_at"):
                    c["created_at"] = str(c["created_at"])
            return {"contacts": contacts}
    finally:
        conn.close()


@app.post("/api/admin/clients/{client_id}/contacts", status_code=201)
def admin_add_contact(client_id: int, body: AddContactRequest, user: dict = Depends(require_admin)):
    _assert_client_company(client_id, user)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "INSERT INTO local_reference.client_contacts (client_id, contact_name) VALUES (%s, %s)",
                    (client_id, body.contact_email.strip()),
                )
                conn.commit()
                cache_bust()
                return {"id": cur.lastrowid}
            except Exception as e:
                if "Duplicate entry" in str(e):
                    raise HTTPException(status_code=409, detail="Contact already mapped")
                raise
    finally:
        conn.close()


@app.delete("/api/admin/contacts/{mapping_id}")
def admin_remove_contact(mapping_id: int, user: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if not user.get("is_super_admin"):
                cur.execute("""
                    SELECT cc.id FROM local_reference.client_contacts cc
                    JOIN local_reference.clients c ON c.id = cc.client_id
                    WHERE cc.id = %s AND c.company_name = %s
                """, (mapping_id, user["company_name"]))
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Access denied")
            cur.execute("DELETE FROM local_reference.client_contacts WHERE id = %s", (mapping_id,))
            conn.commit()
            cache_bust()
            return {"ok": True}
    finally:
        conn.close()


@app.get("/api/admin/suggest-contacts")
def suggest_contacts(company: str, q: str = "", user: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ct_ContactNameFull AS contact_name
                FROM shopworks.orders
                WHERE CompanyName = %s
                  AND ct_ContactNameFull IS NOT NULL AND ct_ContactNameFull != ''
                  AND ct_ContactNameFull LIKE %s
                ORDER BY ct_ContactNameFull
                LIMIT 20
                """,
                (company, f"%{q}%"),
            )
            return {"contacts": [r["contact_name"] for r in cur.fetchall()]}
    finally:
        conn.close()


@app.get("/api/admin/companies")
def list_companies(q: str = "", user: dict = Depends(require_admin)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT CompanyName AS company_name
                FROM shopworks.orders
                WHERE CompanyName IS NOT NULL AND CompanyName != ''
                  AND CompanyName LIKE %s
                ORDER BY CompanyName
                LIMIT 50
                """,
                (f"%{q}%" if q else "%",),
            )
            return {"companies": [r["company_name"] for r in cur.fetchall()]}
    finally:
        conn.close()


@app.get("/api/health")
def health():
    return {"ok": True}


class ForgotPasswordRequest(BaseModel):
    email: str


@app.post("/api/auth/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    token = secrets.token_urlsafe(48)
    expires = datetime.utcnow() + timedelta(hours=72)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, company_name, password_hash FROM local_reference.clients WHERE email = %s",
                (body.email,),
            )
            row = cur.fetchone()
        if row and row["password_hash"]:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE local_reference.clients SET invite_token = %s, invite_expires_at = %s WHERE email = %s",
                    (token, expires, body.email),
                )
                conn.commit()
            background_tasks.add_task(send_reset_email, body.email, row["company_name"], token)
            log.info(f"Password reset requested for {body.email}")
    finally:
        conn.close()
    # Always return ok — never reveal if email exists
    return {"ok": True}


# ── Admin: cache + logs ───────────────────────────────────────────────────────

@app.get("/api/admin/cache")
def admin_cache_info(user: dict = Depends(require_super_admin)):
    return {"cache": cache_info()}


@app.post("/api/admin/cache/bust")
def admin_cache_bust(user: dict = Depends(require_super_admin)):
    cache_bust()
    log.info(f"Cache busted by {user['sub']}")
    return {"ok": True}


@app.get("/api/admin/logs")
def admin_get_logs(lines: int = 300, user: dict = Depends(require_super_admin)):
    try:
        with open(LOG_FILE, encoding="utf-8") as f:
            all_lines = f.readlines()
        return {"lines": [l.rstrip() for l in all_lines[-lines:]], "total": len(all_lines)}
    except FileNotFoundError:
        return {"lines": [], "total": 0}


# ── Serve built React frontend (production) ───────────────────────────────────

DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(DIST_DIR / "index.html"))
