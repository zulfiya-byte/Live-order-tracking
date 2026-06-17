import os
import queue
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

_POOL_SIZE = 5
_pool: queue.Queue = queue.Queue(maxsize=_POOL_SIZE)


class PooledConn:
    """Wraps a PyMySQL connection so .close() returns it to the pool."""

    def __init__(self, conn):
        self._conn = conn

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close(self):
        try:
            _pool.put_nowait(self._conn)
        except queue.Full:
            try:
                self._conn.close()
            except Exception:
                pass


def _new_conn():
    return pymysql.connect(**_cfg)


def get_conn() -> PooledConn:
    """Return a pooled connection. Caller must call .close() when done."""
    try:
        conn = _pool.get_nowait()
        conn.ping(reconnect=True)
        return PooledConn(conn)
    except (queue.Empty, Exception):
        return PooledConn(_new_conn())
