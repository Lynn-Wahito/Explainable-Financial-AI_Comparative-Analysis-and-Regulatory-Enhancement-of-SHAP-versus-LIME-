# backend/src/auth/utils.py
import os
import time
import secrets
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt

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
