# backend/src/auth/utils.py
import os
import time
import secrets
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

# Local imports
from ..db import SessionLocal
from .models import User

# Password hashing context
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Config
SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-demo-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 24  # 24 hours


def hash_password(password: str) -> str:
    """Hashes a plain-text password."""
    return pwd_ctx.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verifies a plain-text password against a hashed password."""
    return pwd_ctx.verify(plain, hashed)


def create_access_token(subject: str, data: dict = None, expires_in: int = ACCESS_TOKEN_EXPIRE_SECONDS):
    """Creates a signed JWT token."""
    payload = {"sub": subject}
    if data:
        payload.update(data)
    payload.update({"exp": int(time.time()) + int(expires_in)})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def generate_reset_token() -> str:
    """Generates a secure password reset token."""
    return secrets.token_urlsafe(24)


def generate_verification_token() -> str:
    """Generates a secure email verification token."""
    return secrets.token_urlsafe(32)


def verify_token(stored_token: str, received_token: str, expiry: datetime) -> bool:
    """Verifies that a token matches and is still valid."""
    if stored_token != received_token:
        return False
    return datetime.utcnow() <= expiry


# -----------------------------------------------------------
# 🧩 JWT Authentication Dependency (added)
# -----------------------------------------------------------

bearer_scheme = HTTPBearer(auto_error=False)


def _get_db():
    """Creates a local DB session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(_get_db),
) -> User:
    """
    Dependency to get the current authenticated user from JWT.
    Verifies the token and returns the corresponding User record.
    """
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = creds.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    try:
        user_id_int = int(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    user = db.get(User, user_id_int)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    return user
