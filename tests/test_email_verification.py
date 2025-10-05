# tests/test_email_verification.py
import time
from fastapi.testclient import TestClient
from backend.src.main import app
from backend.src.db import SessionLocal
from backend.src.auth.models import User

client = TestClient(app)

def _get_user(email: str):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()

def test_email_verification_flow():
    email = f"ev{int(time.time())}@example.com"
    password = "Pass123!"

    # 1) Register
    r = client.post("/auth/register", json={"email": email, "password": password, "role": "user"})
    assert r.status_code == 200

    # 2) Request verification
    r = client.post("/auth/request-verification", json={"email": email})
    assert r.status_code == 200

    # 3) Get token from DB
    user = _get_user(email)
    assert user and user.verification_token, "No verification token set"

    # 4) Verify email
    r = client.post("/auth/verify-email", json={"token": user.verification_token})
    assert r.status_code == 200
    assert r.json()["is_verified"] is True
