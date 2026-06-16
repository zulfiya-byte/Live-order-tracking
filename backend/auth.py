import os
import bcrypt as _bcrypt
import jwt
from datetime import datetime, timedelta, timezone
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
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password(plain: str) -> str:
    """Utility — use this to generate hashes for the clients table."""
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt(12)).decode()
