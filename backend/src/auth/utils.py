# backend/src/auth/utils.py
import os, time
from passlib.context import CryptContext
from jose import jwt

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-demo-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 24  # 24h

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(subject: str, data: dict = None, expires_in: int = ACCESS_TOKEN_EXPIRE_SECONDS):
    payload = {"sub": subject}
    if data:
        payload.update(data)
    payload.update({"exp": int(time.time()) + int(expires_in)})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def generate_reset_token():
    import secrets
    return secrets.token_urlsafe(24)
