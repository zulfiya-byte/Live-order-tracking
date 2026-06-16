import os
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from db import get_conn
from auth import verify_token, check_password, make_token

load_dotenv(Path(__file__).parent / ".env")

app = FastAPI(title="PXP Order Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
def login(body: LoginRequest):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email, password_hash, company_name FROM local_reference.clients WHERE email = %s",
                (body.email,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row or not check_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = make_token(row["email"], row["company_name"])
    return {"token": token, "company_name": row["company_name"]}


# ── Orders ────────────────────────────────────────────────────────────────────

_ORDERS_SQL = """
SELECT
    o.ID_Order                                                 AS order_number,
    o.cn_TotalProductQty_Current                               AS product_quantity,
    COALESCE(ot.name, CAST(o.id_OrderType AS CHAR))            AS order_type,
    l.location_name                                            AS pxp_location,
    TRIM(CONCAT(COALESCE(e.first_name,''), ' ', COALESCE(e.last_name,''))) AS pxp_ae,
    o.CustomerPurchaseOrder                                    AS purchase_order,
    o.ct_ContactNameFull                                       AS order_contact,
    od.ct_DesignName                                           AS design_name,
    o.date_OrderRequestedToShip                                AS request_to_ship_date,
    o.sts_Shipped                                              AS shipped,
    (o.cn_sts_HoldOrderGraphic = '10')                         AS on_hold
FROM shopworks.orders o
LEFT JOIN shopworks.orderdes od
    ON od.id_Order = o.ID_Order
    AND (od.deleted IS NULL OR od.deleted = 0)
LEFT JOIN shopworks.location l
    ON l.id_CompanyLocation = o.id_CompanyLocation
LEFT JOIN shopworks.employee e
    ON e.id_employee = o.id_EmpCreatedBy
LEFT JOIN local_reference.order_type ot
    ON CAST(ot.id AS UNSIGNED) = o.id_OrderType
WHERE (o.deleted IS NULL OR o.deleted = 0)
    AND o.CompanyName = %s
"""


def _build_filter_clause(params: dict) -> tuple[str, list]:
    """Returns (extra_sql, extra_args) for optional sidebar filters."""
    clauses, args = [], []

    if params.get("order_number"):
        clauses.append("AND o.ID_Order = %s")
        args.append(int(params["order_number"]))

    if params.get("purchase_order"):
        clauses.append("AND o.CustomerPurchaseOrder LIKE %s")
        args.append(f"%{params['purchase_order']}%")

    if params.get("order_contact"):
        clauses.append("AND o.ct_ContactNameFull LIKE %s")
        args.append(f"%{params['order_contact']}%")

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
        clauses.append("AND o.sts_Shipped = 0")

    return " ".join(clauses), args


@app.get("/api/orders")
def get_orders(
    order_number: str = None,
    purchase_order: str = None,
    order_contact: str = None,
    order_type: str = None,
    ship_date_from: str = None,
    ship_date_to: str = None,
    shipped: str = None,
    user: dict = Depends(verify_token),
):
    company = user["company_name"]
    extra_sql, extra_args = _build_filter_clause({
        "order_number": order_number,
        "purchase_order": purchase_order,
        "order_contact": order_contact,
        "order_type": order_type,
        "ship_date_from": ship_date_from,
        "ship_date_to": ship_date_to,
        "shipped": shipped,
    })
    sql = _ORDERS_SQL + extra_sql + " ORDER BY o.date_OrderRequestedToShip DESC LIMIT 1000"
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, [company] + extra_args)
            rows = cur.fetchall()
    finally:
        conn.close()

    for row in rows:
        if row.get("request_to_ship_date"):
            row["request_to_ship_date"] = str(row["request_to_ship_date"])
        row["on_hold"] = bool(row.get("on_hold"))
        row["shipped"] = row.get("shipped") == 1

    return {"orders": rows, "count": len(rows)}


# ── Filters ───────────────────────────────────────────────────────────────────

@app.get("/api/filters")
def get_filters(user: dict = Depends(verify_token)):
    company = user["company_name"]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT COALESCE(ot.name, CAST(o.id_OrderType AS CHAR)) AS order_type
                FROM shopworks.orders o
                LEFT JOIN local_reference.order_type ot ON CAST(ot.id AS UNSIGNED) = o.id_OrderType
                WHERE (o.deleted IS NULL OR o.deleted = 0) AND o.CompanyName = %s
                  AND ot.name IS NOT NULL
                ORDER BY ot.name
                """,
                (company,),
            )
            order_types = [r["order_type"] for r in cur.fetchall()]
    finally:
        conn.close()
    return {"order_types": order_types}


@app.get("/api/health")
def health():
    return {"ok": True}
