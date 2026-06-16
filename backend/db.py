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
