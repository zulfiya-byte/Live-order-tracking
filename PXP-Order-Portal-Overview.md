# PXP Solutions — Client Order Portal
## System Overview Document

---

## What Is This?

The PXP Order Portal is a secure, web-based tool that allows PXP clients to log in and view the real-time status of their orders — from production through shipment. Clients can access it from any phone, tablet, or laptop without needing to call or email PXP for updates.

---

## What Can Clients See?

Once logged in, a client sees only **their own company's orders**. No client can ever see another company's data.

For each order, they can see:

| Field | What It Means |
|---|---|
| Order Number | The PXP internal order ID |
| Order Type | Screenprint, Embroidery, etc. |
| Design Name | Name of the artwork/design |
| Purchase Order # | The client's own PO reference |
| Order Contact | Who placed the order |
| Quantity | Number of items |
| PXP Location | Which PXP facility is handling it |
| PXP AE | The Account Executive assigned |
| Requested Ship Date | When the client needs it shipped |
| Art Done | Whether artwork has been approved |
| Purchased | Whether materials have been ordered |
| Garments Received | Whether garments have arrived at PXP |
| On Hold | Highlighted in yellow if the order is paused |
| Shipped | Green checkmark once it has shipped |
| Ship Date / Carrier / Tracking | Full shipping details once dispatched |
| Notes | Any notes from PXP to the client |

---

## How Clients Use It

1. Client goes to the portal URL on their phone or computer
2. They enter their email and password (provided by PXP)
3. They land on the dashboard showing their orders grouped by status:
   - **All Orders** — everything
   - **Active** — currently in production
   - **Shipped** — completed and shipped
   - **On Hold** — orders that need attention
4. On mobile, each order appears as a card with a color-coded status and a production progress tracker (Art → Purchased → Garments)
5. On desktop, orders appear in a full table with sortable columns
6. Clients can filter by PO number, design name, contact, order type, and date range
7. They can export their orders to a CSV file or print a clean report

---

## How the System Is Built

The portal has three parts that work together:

### 1. The Frontend (What the Client Sees)
- A modern web app built with **React** and styled with the PXP brand (blue `#29ABE2`)
- Mobile-first design — looks and works great on a phone
- Hosted on a **DigitalOcean server** (IP: 143.198.14.93, port 8002)
- The PXP Solutions logo and brand colors are used throughout

### 2. The Backend (The Engine)
- A **Python API** (FastAPI framework) that sits between the frontend and the database
- It handles logins, checks permissions, and fetches order data
- Also hosted on the same DigitalOcean server
- Runs as a background service that restarts automatically if the server reboots

### 3. The Database (The Data Source)
- The portal reads directly from the **ShopWorks database** — the same system PXP already uses internally
- This means order data is always live and accurate — no manual exports or syncing needed
- The connection goes through a secure SSH tunnel so the database is never exposed to the internet
- A separate small table (`local_reference.clients`) stores portal login credentials

---

## Security

| Layer | How It Works |
|---|---|
| Login | Email + password, bcrypt-hashed (industry standard) |
| Session tokens | JWT tokens expire after 8 hours — clients must re-login daily |
| Data isolation | Every API query is filtered by company name from the token — server-side, not client-side |
| Database | Not exposed to the internet; only reachable through an encrypted SSH tunnel |
| HTTPS | All traffic encrypted in transit via Caddy (automatic SSL certificates) |

**Clients cannot see each other's data under any circumstance.** The company filter is enforced on the server, not the browser.

---

## Admin Panel

PXP staff with admin access can:
- Create new client logins (email, password, company name)
- Assign contact-level filters (so a login only sees orders for specific contacts within a company)
- Reset passwords
- Toggle admin access on/off
- Delete client accounts

The admin panel is accessible at `/admin` and is only visible to accounts with the admin flag set.

---

## Contact-Level Access Control

By default, a client account sees **all orders** for their company.

If a client should only see orders for specific contacts (e.g., a rep who manages one division), an admin can add contact names to their account. Once contacts are added, that login will only see orders where the "Order Contact" field matches one of those names.

---

## Summary

| | |
|---|---|
| **Purpose** | Give clients 24/7 self-service visibility into their PXP orders |
| **Data source** | Live ShopWorks database — always up to date |
| **Access** | Secure login, company-scoped, works on any device |
| **Hosting** | DigitalOcean cloud server (already running) |
| **Maintenance** | Minimal — no manual data entry, pulls live from ShopWorks |
| **Admin control** | Full — PXP can add/remove/edit client access at any time |

---

*Prepared by: PXP Development Team*
*Last updated: June 2026*
