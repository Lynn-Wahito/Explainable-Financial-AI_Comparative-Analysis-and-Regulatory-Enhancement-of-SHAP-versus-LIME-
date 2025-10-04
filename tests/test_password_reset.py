# tests/test_password_reset.py
import time, os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from fastapi.testclient import TestClient
from backend.src.main import app
from backend.src.db import SessionLocal
from backend.src.auth.models import User

client = TestClient(app)

def _get_user(email):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()

def test_password_reset_flow():
    email = f"pr{int(time.time())}@example.com"
    pw = "OrigPass123!"

    # register
    r = client.post("/auth/register", json={"email": email, "password": pw, "role": "user"})
    assert r.status_code == 200

    # request reset
    r = client.post("/auth/request-reset", json={"email": email})
    assert r.status_code == 200

    # read token from DB
    user = _get_user(email)
    assert user and user.reset_token, "reset token missing"
    token = user.reset_token

    # reset password
    r = client.post("/auth/reset-password", json={"token": token, "new_password": "NewPass123!"})
    assert r.status_code == 200

    # can login with new password
    r = client.post("/auth/login", json={"email": email, "password": "NewPass123!"})
    assert r.status_code == 200
    assert "access_token" in r.json()
