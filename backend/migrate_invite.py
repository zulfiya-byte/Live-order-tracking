"""
Run once to add invite token columns to local_reference.clients.
Usage: python migrate_invite.py
"""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from db import get_conn

MIGRATIONS = [
    # Make password_hash nullable so invited accounts exist before password is set
    "ALTER TABLE local_reference.clients MODIFY COLUMN password_hash VARCHAR(255) NULL",
    # Add invite token (URL-safe random string)
    "ALTER TABLE local_reference.clients ADD COLUMN invite_token VARCHAR(100) NULL",
    # Add expiry timestamp
    "ALTER TABLE local_reference.clients ADD COLUMN invite_expires_at DATETIME NULL",
]

conn = get_conn()
try:
    with conn.cursor() as cur:
        for sql in MIGRATIONS:
            try:
                cur.execute(sql)
                print(f"OK: {sql[:60]}...")
            except Exception as e:
                if "Duplicate column" in str(e) or "already exists" in str(e):
                    print(f"SKIP (already applied): {sql[:60]}...")
                elif "doesn't exist" in str(e):
                    print(f"SKIP (column not found): {sql[:60]}...")
                else:
                    print(f"ERROR: {e}")
        conn.commit()
    print("\nMigration complete.")
finally:
    conn.close()
