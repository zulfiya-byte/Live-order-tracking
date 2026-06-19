"""UPS Tracking API client (OAuth client-credentials).

Mirrors the urllib-based pattern used in email_utils for Microsoft Graph.
Credentials come from the environment (UPS_CLIENT_ID / UPS_CLIENT_SECRET).
"""
import os
import time
import json
import base64
import threading
import urllib.request
import urllib.parse
import urllib.error

UPS_CLIENT_ID     = os.getenv("UPS_CLIENT_ID", "")
UPS_CLIENT_SECRET = os.getenv("UPS_CLIENT_SECRET", "")
UPS_ENV           = os.getenv("UPS_ENV", "production").strip().lower()

_BASE = "https://wwwcie.ups.com" if UPS_ENV in ("test", "cie", "sandbox") else "https://onlinetools.ups.com"

_token = {"value": None, "exp": 0.0}
_lock = threading.Lock()


def is_configured() -> bool:
    return bool(UPS_CLIENT_ID and UPS_CLIENT_SECRET)


def _get_token() -> str:
    with _lock:
        if _token["value"] and time.time() < _token["exp"] - 60:
            return _token["value"]
        auth = base64.b64encode(f"{UPS_CLIENT_ID}:{UPS_CLIENT_SECRET}".encode()).decode()
        req = urllib.request.Request(
            _BASE + "/security/v1/oauth/token",
            data=b"grant_type=client_credentials",
            headers={"Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + auth},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            d = json.loads(resp.read().decode())
        _token["value"] = d["access_token"]
        _token["exp"] = time.time() + int(d.get("expires_in", 14399))
        return _token["value"]


def _normalize(desc: str, code: str) -> str:
    """Map a UPS status to a normalized state used for badge colour/label."""
    d = (desc or "").lower()
    if code == "011" or "delivered" in d:
        return "delivered"
    if "out for delivery" in d:
        return "out_for_delivery"
    if any(k in d for k in ("exception", "delayed", "attempt", "returned", "rescheduled", "held")):
        return "exception"
    if any(k in d for k in ("label", "order processed", "ready for ups", "shipment received", "created")):
        return "label_created"
    return "in_transit"


def _fmt_date(raw):
    return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}" if raw and len(raw) == 8 else None


def track(number: str) -> dict:
    """Return a normalized tracking result for one UPS number."""
    number = (number or "").strip()
    base = {"tracking_number": number, "carrier": "UPS"}
    if not is_configured():
        return {**base, "status": "unknown", "error": "UPS API not configured"}
    try:
        tok = _get_token()
        req = urllib.request.Request(
            _BASE + f"/api/track/v1/details/{urllib.parse.quote(number)}",
            headers={
                "Authorization": "Bearer " + tok,
                "transId": f"pxp{int(time.time() * 1000) % (10 ** 14)}",
                "transactionSrc": "pxp-portal",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        pkg = data["trackResponse"]["shipment"][0]["package"][0]
        cs = pkg.get("currentStatus") or {}
        desc = cs.get("description") or "In Transit"
        code = cs.get("code") or ""
        status = _normalize(desc, code)
        dd = pkg.get("deliveryDate") or []
        delivery_date = _fmt_date(dd[0].get("date")) if dd else None
        events = []
        for a in (pkg.get("activity") or [])[:12]:
            loc = (a.get("location") or {}).get("address") or {}
            place = ", ".join(x for x in (loc.get("city"), loc.get("stateProvince")) if x)
            t = a.get("time") or ""
            events.append({
                "date": _fmt_date(a.get("date")) or "",
                "time": f"{t[0:2]}:{t[2:4]}" if len(t) >= 4 else "",
                "desc": (a.get("status") or {}).get("description") or "",
                "location": place,
            })
        return {**base, "status": status, "status_desc": desc, "delivery_date": delivery_date,
                "delivered": status == "delivered", "events": events, "error": None}
    except urllib.error.HTTPError as e:
        msg = "Not in UPS system yet" if e.code == 404 else f"UPS error {e.code}"
        return {**base, "status": "unknown", "error": msg}
    except Exception as e:
        return {**base, "status": "unknown", "error": str(e)[:120]}
