import time

_store: dict = {}
CACHE_TTL = 90 * 60  # 90 minutes


def cache_get(key: str):
    entry = _store.get(key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]
    _store.pop(key, None)
    return None


def cache_set(key: str, data) -> None:
    _store[key] = {"data": data, "ts": time.time()}


def cache_bust(key: str = None) -> None:
    if key:
        _store.pop(key, None)
    else:
        _store.clear()


def cache_info() -> dict:
    now = time.time()
    return {
        k: {"ttl_remaining_s": round(CACHE_TTL - (now - v["ts"]))}
        for k, v in list(_store.items())
        if now - v["ts"] < CACHE_TTL
    }
