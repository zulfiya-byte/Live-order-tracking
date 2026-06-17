# PXP Order Visibility Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a JWT-authenticated order visibility portal where PXP clients log in and see only their own orders from the ShopWorks MySQL replica, filtered server-side by the `company_name` claim in their JWT.

**Architecture:** FastAPI (Python) backend runs on the DigitalOcean droplet (143.198.14.93) as a systemd/uvicorn service on port 8002, connecting to MySQL as `swro@127.0.0.1`. The React/Vite frontend build is served as static files from the same droplet via Caddy (already running), which also reverse-proxies `/api/*` to port 8002 — same pattern as art-kpi. Because frontend and API share the same origin, all API calls use relative URLs. A `clients` table in `local_reference` stores email + bcrypt hash + company_name; all order queries filter by the company_name from the JWT — never from a client-supplied parameter.

**Tech Stack:** Python 3.11, FastAPI, uvicorn, PyMySQL, PyJWT, passlib[bcrypt]; React 18, Vite 5, Tailwind CSS 3, React Router 6; Caddy (existing).

---

## File Map

```
pxp-order-dashboard/
  backend/
    main.py              — FastAPI app, all routes
    db.py                — PyMySQL connection pool helper
    auth.py              — JWT sign/verify, password hash/check
    requirements.txt
    .env.example
    pxp-dashboard.service  — systemd unit (copy to /etc/systemd/system/)
  frontend/
    public/
      pxp-logo.png       — copy from C:\Users\zulfiya\Desktop\art-kpi-dashboard\Logos\PXP Logo-02.png
    src/
      main.jsx
      App.jsx            — routes: /login → /dashboard (protected)
      api.js             — fetch wrapper, injects Authorization: Bearer header
      pages/
        Login.jsx        — email/password form, stores JWT in localStorage
        Dashboard.jsx    — layout: Sidebar + OrderTable
      components/
        Sidebar.jsx      — filter controls, calls onFilter(params)
        OrderTable.jsx   — data table, green row when on_hold=true
    index.html
    vite.config.js       — proxy /api → http://localhost:8002 in dev only
    package.json
  setup/
    setup-db.sql         — CREATE TABLE clients, INSERT sample client row
    caddy-block.txt      — Caddy config block (static files + API proxy)
```

---

## Task 1: MySQL — create clients table and seed first client

**Files:**
- Create: `setup/setup-db.sql`

The `clients` table goes in `local_reference` because `swro` already has SELECT on it. Root creates the table once via `debian.cnf`; the app only needs SELECT.

- [ ] **Step 1: Write setup-db.sql**

```sql
-- Run on droplet as: mysql --defaults-file=/etc/mysql/debian.cnf < setup-db.sql

CREATE TABLE IF NOT EXISTS local_reference.clients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company_name  VARCHAR(128) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sample client — replace password_hash with real bcrypt hash before use.
-- Generate hash: python3 -c "from passlib.hash import bcrypt; print(bcrypt.hash('YourPassword123'))"
INSERT INTO local_reference.clients (email, password_hash, company_name)
VALUES ('client@example.com', '$2b$12$PLACEHOLDER_REPLACE_WITH_REAL_HASH', 'PXP Solutions')
ON DUPLICATE KEY UPDATE company_name = VALUES(company_name);
```

- [ ] **Step 2: Run it on the droplet**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
  "mysql --defaults-file=/etc/mysql/debian.cnf" < setup/setup-db.sql
```

Expected: no errors. Verify:

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
  "mysql --defaults-file=/etc/mysql/debian.cnf local_reference -e 'SELECT id, email, company_name FROM clients;'"
```

Expected: one row with `client@example.com` / `PXP Solutions`.

- [ ] **Step 3: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard init
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add setup/setup-db.sql
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: clients table setup script"
```

---

## Task 2: Backend scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`

- [ ] **Step 1: Write requirements.txt**

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
PyMySQL==1.1.1
cryptography==43.0.3
PyJWT==2.10.1
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
```

- [ ] **Step 2: Write .env.example**

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=swro
MYSQL_PASS=your_swro_password_here
JWT_SECRET=change_this_to_a_long_random_string
```

- [ ] **Step 3: Create the actual .env on the droplet**

SSH into droplet and create `/opt/pxp-dashboard/.env`:

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "mkdir -p /opt/pxp-dashboard"
```

Then write `/opt/pxp-dashboard/.env` with these values:
```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=swro
MYSQL_PASS=eshqAA7HmdA4L2W8SlxCEag6o9BzM3Fw
JWT_SECRET=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">
```

- [ ] **Step 4: Set up Python venv on droplet**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
  "cd /opt/pxp-dashboard && python3 -m venv venv && venv/bin/pip install -r /dev/stdin" \
  < backend/requirements.txt
```

Expected: packages install without errors.

- [ ] **Step 5: Write .gitignore at project root**

```
backend/.env
backend/venv/
frontend/node_modules/
frontend/dist/
```

- [ ] **Step 6: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add backend/requirements.txt backend/.env.example .gitignore
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: backend scaffold and requirements"
```

---

## Task 3: Database connection module

**Files:**
- Create: `backend/db.py`
- Test: run a manual query to verify connectivity

- [ ] **Step 1: Write db.py**

```python
import os
import pymysql
import pymysql.cursors
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

_cfg = dict(
    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
    port=int(os.getenv("MYSQL_PORT", 3306)),
    user=os.getenv("MYSQL_USER", "swro"),
    password=os.getenv("MYSQL_PASS", ""),
    cursorclass=pymysql.cursors.DictCursor,
    autocommit=True,
)

def get_conn():
    """Return a new PyMySQL connection. Caller must close it."""
    return pymysql.connect(**_cfg)
```

- [ ] **Step 2: Smoke-test connectivity**

Create a temporary test file `backend/test_db.py` and run it:

```python
from db import get_conn
conn = get_conn()
with conn.cursor() as cur:
    cur.execute("SELECT COUNT(*) as n FROM shopworks.orders WHERE deleted IS NULL OR deleted=0")
    print(cur.fetchone())
conn.close()
```

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
  "cd /opt/pxp-dashboard && venv/bin/python" < backend/test_db.py
```

Expected: `{'n': <some large number>}` — no errors.

Delete `backend/test_db.py` after verifying.

- [ ] **Step 3: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add backend/db.py
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: mysql connection module"
```

---

## Task 4: Auth module (JWT + password verification)

**Files:**
- Create: `backend/auth.py`

- [ ] **Step 1: Write auth.py**

```python
import os
import jwt
from datetime import datetime, timedelta, timezone
from passlib.hash import bcrypt as pw_hash
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGO   = "HS256"
JWT_TTL_H  = 8

_bearer = HTTPBearer()


def make_token(email: str, company_name: str) -> str:
    payload = {
        "sub": email,
        "company_name": company_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_H),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def verify_token(creds: HTTPAuthorizationCredentials = Security(_bearer)) -> dict:
    try:
        return jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def check_password(plain: str, hashed: str) -> bool:
    return pw_hash.verify(plain, hashed)


def hash_password(plain: str) -> str:
    """Utility — use this to generate hashes for the clients table."""
    return pw_hash.hash(plain)
```

- [ ] **Step 2: Generate a real bcrypt hash for the sample client**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
  "cd /opt/pxp-dashboard && venv/bin/python3 -c \"from passlib.hash import bcrypt; print(bcrypt.hash('ClientPassword1!'))\""
```

Copy the output hash and update the INSERT in `setup/setup-db.sql`, then re-run setup-db.sql on the droplet.

- [ ] **Step 3: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add backend/auth.py setup/setup-db.sql
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: jwt auth module and real password hash"
```

---

## Task 5: FastAPI main — login + orders routes

**Files:**
- Create: `backend/main.py`

This is the entire backend. All routes live here following the art-kpi pattern.

- [ ] **Step 1: Write main.py**

```python
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

    # Convert date objects to ISO strings for JSON serialisation
    for row in rows:
        if row.get("request_to_ship_date"):
            row["request_to_ship_date"] = str(row["request_to_ship_date"])
        row["on_hold"] = bool(row.get("on_hold"))
        row["shipped"] = row.get("shipped") == 1

    return {"orders": rows, "count": len(rows)}


# ── Filters (distinct values for sidebar dropdowns) ───────────────────────────

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
```

- [ ] **Step 2: Deploy main.py to droplet**

```bash
scp -i ~/.ssh/id_ed25519 backend/main.py backend/db.py backend/auth.py \
    root@143.198.14.93:/opt/pxp-dashboard/
```

- [ ] **Step 3: Smoke-test the API manually**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
  "cd /opt/pxp-dashboard && venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002 &
   sleep 2 && curl -s http://127.0.0.1:8002/api/health && kill %1"
```

Expected: `{"ok":true}`

- [ ] **Step 4: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add backend/main.py
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: fastapi backend with login and orders routes"
```

---

## Local Testing (do this after Task 5, before Task 6)

Run the full stack on your laptop to verify everything works before touching the droplet.

**Why an SSH tunnel?** MySQL is bound to `127.0.0.1` on the droplet — it doesn't accept outside connections. The tunnel forwards a local port on your machine to MySQL on the droplet, so the FastAPI backend running locally can reach it.

- [ ] **Step 1: Open SSH tunnel to MySQL in a terminal (keep it open)**

```bash
ssh -i ~/.ssh/id_ed25519 -L 3307:127.0.0.1:3306 -N root@143.198.14.93
```

Leave this running. Port 3307 on your laptop now connects to MySQL on the droplet. (Using 3307 to avoid conflicts if MySQL is installed locally.)

- [ ] **Step 2: Create a local backend .env**

Create `backend/.env` (this file is gitignored — never commit it):

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_USER=swro
MYSQL_PASS=eshqAA7HmdA4L2W8SlxCEag6o9BzM3Fw
JWT_SECRET=local-dev-secret-not-for-production
```

- [ ] **Step 3: Install Python deps locally in a new terminal**

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

- [ ] **Step 4: Run FastAPI locally**

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard\backend
venv\Scripts\uvicorn main:app --port 8002 --reload
```

Expected output: `Uvicorn running on http://127.0.0.1:8002`

- [ ] **Step 5: Run the frontend dev server in another terminal**

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard\frontend
npm run dev
```

Expected: `Local: http://localhost:5173`

Vite already proxies `/api/*` → `http://localhost:8002`, so no config changes needed.

- [ ] **Step 6: Test the full flow in your browser**

Open http://localhost:5173 and verify:
- Redirects to `/login`
- PXP logo and navy background appear
- Login with real credentials (from the `clients` table you seeded in Task 1) → redirects to `/dashboard`
- Orders table loads with data for that company only
- On Hold rows appear with green background
- Sidebar filters narrow the results (try Order Type dropdown, ship date range)
- Sign out clears session, returns to login

- [ ] **Step 7: Stop local servers when done**

Press `Ctrl+C` in both terminal windows. Close the SSH tunnel terminal.

---

## Task 6: Systemd service + Caddy block

**Files:**
- Create: `backend/pxp-dashboard.service`
- Create: `setup/caddy-block.txt`

- [ ] **Step 1: Write pxp-dashboard.service**

```ini
[Unit]
Description=PXP Order Dashboard FastAPI backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/pxp-dashboard
EnvironmentFile=/opt/pxp-dashboard/.env
ExecStart=/opt/pxp-dashboard/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Write caddy-block.txt**

This block gets appended to `/etc/caddy/Caddyfile` on the droplet. Replace `orders.yourdomain.com` with the actual subdomain you'll use (e.g. `orders.pepwearevents.com`).

```
orders.yourdomain.com {
    encode gzip

    handle /api/* {
        reverse_proxy 127.0.0.1:8002
    }

    handle {
        root * /var/www/pxp-dashboard
        try_files {path} /index.html
        file_server
    }

    log {
        output file /var/log/caddy/pxp-dashboard.log {
            roll_size 50mb
            roll_keep 10
        }
        format json
    }
}
```

- [ ] **Step 3: Install service and reload Caddy on droplet**

```bash
scp -i ~/.ssh/id_ed25519 backend/pxp-dashboard.service \
    root@143.198.14.93:/etc/systemd/system/pxp-dashboard.service

ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "
  systemctl daemon-reload &&
  systemctl enable pxp-dashboard &&
  systemctl start pxp-dashboard &&
  systemctl status pxp-dashboard --no-pager
"
```

Expected: `Active: active (running)`.

- [ ] **Step 4: Add Caddy block and reload**

Append `caddy-block.txt` content to `/etc/caddy/Caddyfile` on the droplet (with the real subdomain filled in), then:

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "systemctl reload caddy"
```

- [ ] **Step 5: Test the live endpoint**

```bash
curl -s https://orders.yourdomain.com/api/health
```

Expected: `{"ok":true}`

- [ ] **Step 6: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add backend/pxp-dashboard.service setup/caddy-block.txt
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: systemd service and caddy config"
```

---

## Task 7: Frontend scaffold

**Files:**
- Create: `frontend/` (Vite project)

- [ ] **Step 1: Scaffold Vite + React project**

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard
npm create vite@latest frontend -- --template react
cd frontend && npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom
```

- [ ] **Step 2: Configure Tailwind — edit frontend/tailwind.config.js**

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#002856",
        brand: "#d35e13",
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Replace frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Update vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8002',
    },
  },
})
```

- [ ] **Step 5: Copy PXP logo into frontend/public/**

```bash
cp "C:\Users\zulfiya\Desktop\art-kpi-dashboard\Logos\PXP Logo-02.png" \
   "C:\Users\zulfiya\Desktop\pxp-order-dashboard\frontend\public\pxp-logo.png"
```

- [ ] **Step 6: Write frontend/.env.example**

```
VITE_API_URL=https://orders.yourdomain.com
```

- [ ] **Step 7: Run dev server to verify scaffold**

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard\frontend && npm run dev
```

Expected: Vite dev server starts at http://localhost:5173, blank page, no errors.

- [ ] **Step 8: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add frontend/
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: frontend vite scaffold with tailwind"
```

---

## Task 8: API client + App routing

**Files:**
- Create: `frontend/src/api.js`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/main.jsx`

- [ ] **Step 1: Write frontend/src/api.js**

Because the frontend is served from the same Caddy domain as the API, all URLs are relative — no environment variable needed.

```js
const BASE = ''

function headers() {
  const token = localStorage.getItem('pxp_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Invalid credentials')
  const data = await res.json()
  localStorage.setItem('pxp_token', data.token)
  localStorage.setItem('pxp_company', data.company_name)
  return data
}

export function logout() {
  localStorage.removeItem('pxp_token')
  localStorage.removeItem('pxp_company')
}

export async function getOrders(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  const res = await fetch(`${BASE}/api/orders?${params}`, { headers: headers() })
  if (res.status === 401) { logout(); window.location.href = '/login'; return }
  if (!res.ok) throw new Error(`Orders fetch failed: ${res.status}`)
  return res.json()
}

export async function getFilters() {
  const res = await fetch(`${BASE}/api/filters`, { headers: headers() })
  if (!res.ok) throw new Error('Filters fetch failed')
  return res.json()
}

export function isLoggedIn() {
  return !!localStorage.getItem('pxp_token')
}
```

- [ ] **Step 2: Write frontend/src/App.jsx**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { isLoggedIn } from './api'

function Protected({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="*" element={<Navigate to={isLoggedIn() ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Write frontend/src/main.jsx**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
```

- [ ] **Step 4: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add frontend/src/api.js frontend/src/App.jsx frontend/src/main.jsx
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: api client and app routing"
```

---

## Task 9: Login page

**Files:**
- Create: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: Write Login.jsx**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      nav('/dashboard')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="flex justify-center mb-6">
          <img src="/pxp-logo.png" alt="PXP Solutions" className="h-12 object-contain" />
        </div>
        <h1 className="text-center text-navy font-bold text-xl mb-6">Order Portal</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-orange-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test login page in browser**

Run `npm run dev` in `frontend/`, open http://localhost:5173/login. Verify the form renders with logo, navy background, orange button. Submit with wrong credentials — error should appear. (Backend must be running locally or via SSH tunnel for a full test; visual check is sufficient here.)

- [ ] **Step 3: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add frontend/src/pages/Login.jsx
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: login page"
```

---

## Task 10: Sidebar component

**Files:**
- Create: `frontend/src/components/Sidebar.jsx`

- [ ] **Step 1: Write Sidebar.jsx**

```jsx
import { useState } from 'react'

export default function Sidebar({ orderTypes, onFilter, loading }) {
  const [filters, setFilters] = useState({
    purchase_order: '',
    order_number: '',
    order_contact: '',
    order_type: '',
    ship_date_from: '',
    ship_date_to: '',
    shipped: '',
  })

  function set(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function apply() {
    onFilter(filters)
  }

  function reset() {
    const empty = Object.fromEntries(Object.keys(filters).map(k => [k, '']))
    setFilters(empty)
    onFilter(empty)
  }

  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"
  const inputCls = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 p-5 flex flex-col gap-4 overflow-y-auto">
      <h2 className="font-bold text-navy text-sm uppercase tracking-widest">Filters</h2>

      <div>
        <label className={labelCls}>Purchase Order #</label>
        <input className={inputCls} value={filters.purchase_order} onChange={e => set('purchase_order', e.target.value)} placeholder="PO number…" />
      </div>

      <div>
        <label className={labelCls}>Order Number</label>
        <input className={inputCls} type="number" value={filters.order_number} onChange={e => set('order_number', e.target.value)} placeholder="e.g. 204512" />
      </div>

      <div>
        <label className={labelCls}>Order Contact</label>
        <input className={inputCls} value={filters.order_contact} onChange={e => set('order_contact', e.target.value)} placeholder="Contact name…" />
      </div>

      <div>
        <label className={labelCls}>Order Type</label>
        <select className={inputCls} value={filters.order_type} onChange={e => set('order_type', e.target.value)}>
          <option value="">All types</option>
          {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Ship Date From</label>
        <input className={inputCls} type="date" value={filters.ship_date_from} onChange={e => set('ship_date_from', e.target.value)} />
      </div>

      <div>
        <label className={labelCls}>Ship Date To</label>
        <input className={inputCls} type="date" value={filters.ship_date_to} onChange={e => set('ship_date_to', e.target.value)} />
      </div>

      <div>
        <label className={labelCls}>Shipped</label>
        <select className={inputCls} value={filters.shipped} onChange={e => set('shipped', e.target.value)}>
          <option value="">All</option>
          <option value="yes">Shipped</option>
          <option value="no">Not shipped</option>
        </select>
      </div>

      <div className="flex gap-2 mt-2">
        <button onClick={apply} disabled={loading}
          className="flex-1 bg-brand hover:bg-orange-700 text-white text-sm font-semibold py-1.5 rounded transition disabled:opacity-50">
          Apply
        </button>
        <button onClick={reset}
          className="flex-1 border border-gray-300 text-gray-600 text-sm py-1.5 rounded hover:bg-gray-50 transition">
          Reset
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add frontend/src/components/Sidebar.jsx
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: sidebar filter component"
```

---

## Task 11: OrderTable component

**Files:**
- Create: `frontend/src/components/OrderTable.jsx`

Rows where `on_hold === true` are highlighted with a green background.

- [ ] **Step 1: Write OrderTable.jsx**

```jsx
const COLS = [
  { key: 'product_quantity', label: 'Qty' },
  { key: 'order_number',     label: 'Order #' },
  { key: 'order_type',       label: 'Order Type' },
  { key: 'pxp_location',     label: 'PXP Location' },
  { key: 'pxp_ae',           label: 'PXP AE' },
  { key: 'purchase_order',   label: 'PO #' },
  { key: 'order_contact',    label: 'Contact' },
  { key: 'design_name',      label: 'Design Name' },
  { key: 'request_to_ship_date', label: 'Ship Date' },
  { key: 'shipped',          label: 'Shipped' },
]

export default function OrderTable({ orders, loading, error }) {
  if (loading) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      Loading orders…
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
      {error}
    </div>
  )

  if (!orders.length) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      No orders match the current filters.
    </div>
  )

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-navy text-white">
            {COLS.map(c => (
              <th key={c.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-blue-900 last:border-r-0">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((row, i) => (
            <tr
              key={`${row.order_number}-${i}`}
              className={[
                row.on_hold ? 'bg-green-100 hover:bg-green-200' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100',
                'border-b border-gray-200 transition-colors',
              ].join(' ')}
            >
              {COLS.map(c => (
                <td key={c.key} className="px-3 py-2 whitespace-nowrap text-gray-800">
                  {c.key === 'shipped'
                    ? (row.shipped ? '✓' : '—')
                    : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add frontend/src/components/OrderTable.jsx
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: order table with on-hold green highlight"
```

---

## Task 12: Dashboard page (wires everything together)

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Write Dashboard.jsx**

```jsx
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders, getFilters, logout } from '../api'
import Sidebar from '../components/Sidebar'
import OrderTable from '../components/OrderTable'

export default function Dashboard() {
  const nav = useNavigate()
  const company = localStorage.getItem('pxp_company') || ''

  const [orders, setOrders]         = useState([])
  const [orderTypes, setOrderTypes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [activeFilters, setActiveFilters] = useState({})

  const fetchOrders = useCallback(async (filters) => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrders(filters)
      if (data) setOrders(data.orders)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getFilters().then(d => setOrderTypes(d.order_types || []))
    fetchOrders({})
  }, [fetchOrders])

  function handleFilter(filters) {
    setActiveFilters(filters)
    fetchOrders(filters)
  }

  function handleLogout() {
    logout()
    nav('/login')
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="bg-navy text-white flex items-center justify-between px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/pxp-logo.png" alt="PXP Solutions" className="h-8 object-contain brightness-0 invert" />
          <span className="text-sm font-medium opacity-75">{company}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-60">{orders.length} orders</span>
          <button
            onClick={handleLogout}
            className="text-sm border border-white/30 hover:bg-white/10 px-3 py-1 rounded transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          orderTypes={orderTypes}
          onFilter={handleFilter}
          loading={loading}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-navy font-bold text-lg">Orders</h1>
            <span className="text-xs text-gray-400 italic">
              Green rows = On Hold
            </span>
          </div>
          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 shadow-sm flex flex-col">
            <OrderTable orders={orders} loading={loading} error={error} />
          </div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Full end-to-end test in browser**

The Vite dev proxy (port 8002) handles `/api/*` in dev. To test locally you need the backend reachable on port 8002 — either SSH-tunnel it or skip to a full deploy test in Task 13 instead.

Run `npm run dev`, go to http://localhost:5173, confirm:
- Redirects to `/login`
- Login with real client credentials → redirects to `/dashboard`
- Table loads with orders for that company only
- On Hold rows appear green
- Sidebar filters work (apply/reset)
- Sign out clears token, redirects to login

- [ ] **Step 3: Commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard add frontend/src/pages/Dashboard.jsx
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit -m "feat: dashboard page with sidebar and order table wired"
```

---

## Task 13: Deploy frontend to droplet (same pattern as art-kpi)

**Files:** no new files — builds `frontend/dist/` and copies to `/var/www/pxp-dashboard` on the droplet.

- [ ] **Step 1: Build the React app**

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard\frontend
npm run build
```

Expected: `dist/` folder created with `index.html` and hashed JS/CSS assets. No errors.

- [ ] **Step 2: Create the web root on the droplet**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "mkdir -p /var/www/pxp-dashboard"
```

- [ ] **Step 3: Copy dist to droplet**

```bash
scp -i ~/.ssh/id_ed25519 -r \
  C:\Users\zulfiya\Desktop\pxp-order-dashboard\frontend\dist\* \
  root@143.198.14.93:/var/www/pxp-dashboard/
```

- [ ] **Step 4: Verify files landed**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "ls /var/www/pxp-dashboard/"
```

Expected: `index.html` and an `assets/` folder.

- [ ] **Step 5: Reload Caddy to pick up the new block**

```bash
ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "systemctl reload caddy"
```

- [ ] **Step 6: Verify the live site**

Open `https://orders.yourdomain.com` in a browser. Confirm:
- Login page loads with PXP logo and navy background
- Login with real client credentials → dashboard appears
- Orders table loads for that company only
- On Hold rows are green
- Sidebar filters apply and reset correctly
- Sign out clears session and returns to login

- [ ] **Step 7: Final commit**

```bash
git -C C:\Users\zulfiya\Desktop\pxp-order-dashboard commit --allow-empty -m "deploy: frontend live at orders.yourdomain.com"
```

---

## Re-deploying after frontend changes

Whenever you update the frontend code:

```bash
cd C:\Users\zulfiya\Desktop\pxp-order-dashboard\frontend
npm run build
scp -i ~/.ssh/id_ed25519 -r dist\* root@143.198.14.93:/var/www/pxp-dashboard/
```

No Caddy reload needed — static files are served directly.

---

## Adding a new client (no code required)

To onboard a new PXP client:

1. Generate a bcrypt hash for their password:
   ```bash
   ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 \
     "cd /opt/pxp-dashboard && venv/bin/python3 -c \"from passlib.hash import bcrypt; print(bcrypt.hash('TheirPassword'))\""
   ```

2. Insert one row (replace values with real client data):
   ```bash
   ssh -i ~/.ssh/id_ed25519 root@143.198.14.93 "mysql --defaults-file=/etc/mysql/debian.cnf local_reference -e \"
     INSERT INTO clients (email, password_hash, company_name)
     VALUES ('newclient@example.com', '\$2b\$12\$...hash...', 'Their CompanyName In ShopWorks');
   \""
   ```

The `company_name` must exactly match the `CompanyName` value in `shopworks.orders` for their orders.
