"""SQLite-backed client/AE messaging.

Uses a local SQLite file owned by the app, so it needs no MySQL privileges and
no external service. Low volume (support messages), so a connection per call is
fine. A conversation is all rows sharing a client_id.
"""
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

_DB_PATH = Path(__file__).parent / "data" / "messages.db"
_lock = threading.Lock()


def _conn():
    _DB_PATH.parent.mkdir(exist_ok=True)
    c = sqlite3.connect(str(_DB_PATH), timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _lock:
        c = _conn()
        try:
            c.execute(
                """CREATE TABLE IF NOT EXISTS messages (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id    INTEGER NOT NULL,
                    company      TEXT,
                    sender_type  TEXT NOT NULL,         -- 'client' | 'staff'
                    sender_name  TEXT,
                    order_number INTEGER,
                    body         TEXT NOT NULL,
                    created_at   TEXT NOT NULL,
                    read_client  INTEGER DEFAULT 0,
                    read_staff   INTEGER DEFAULT 0
                )"""
            )
            c.execute("CREATE INDEX IF NOT EXISTS idx_msg_client ON messages(client_id)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_msg_company ON messages(company)")
            c.commit()
        finally:
            c.close()


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def add_message(client_id, company, sender_type, sender_name, body, order_number=None):
    with _lock:
        c = _conn()
        try:
            cur = c.execute(
                """INSERT INTO messages
                   (client_id, company, sender_type, sender_name, order_number, body, created_at, read_client, read_staff)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (client_id, company, sender_type, sender_name, order_number, body, _now(),
                 1 if sender_type == "client" else 0,
                 1 if sender_type == "staff" else 0),
            )
            c.commit()
            return cur.lastrowid
        finally:
            c.close()


def get_thread(client_id):
    with _lock:
        c = _conn()
        try:
            rows = c.execute("SELECT * FROM messages WHERE client_id=? ORDER BY id", (client_id,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            c.close()


def mark_read(client_id, by):
    """Mark a conversation read by 'client' or 'staff'."""
    col = "read_client" if by == "client" else "read_staff"
    with _lock:
        c = _conn()
        try:
            c.execute(f"UPDATE messages SET {col}=1 WHERE client_id=?", (client_id,))
            c.commit()
        finally:
            c.close()


def _all_rows():
    with _lock:
        c = _conn()
        try:
            return [dict(r) for r in c.execute("SELECT * FROM messages ORDER BY id").fetchall()]
        finally:
            c.close()


def inbox(all_companies=False, companies=None):
    """Conversation summaries (one per client) the staff member can see."""
    companies = set(companies or [])
    convs = {}
    for r in _all_rows():
        if not all_companies and r["company"] not in companies:
            continue
        conv = convs.setdefault(r["client_id"], {
            "client_id": r["client_id"], "company": r["company"],
            "sender_name": None, "last_body": "", "last_at": "", "last_sender": "", "unread": 0, "count": 0,
        })
        conv["count"] += 1
        conv["last_body"] = r["body"]
        conv["last_at"] = r["created_at"]
        conv["last_sender"] = r["sender_type"]
        if r["sender_type"] == "client":
            conv["sender_name"] = r["sender_name"]
            if not r["read_staff"]:
                conv["unread"] += 1
    out = list(convs.values())
    out.sort(key=lambda x: x["last_at"], reverse=True)
    return out


def staff_unread_count(all_companies=False, companies=None):
    companies = set(companies or [])
    n = 0
    for r in _all_rows():
        if r["sender_type"] == "client" and not r["read_staff"]:
            if all_companies or r["company"] in companies:
                n += 1
    return n
