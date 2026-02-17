import time
from fastapi.testclient import TestClient
from backend.src.main import app
from backend.src.db import SessionLocal
from backend.src.auth.models import User
from backend.src.auth.utils import create_access_token

client = TestClient(app)

def _get_user(email: str):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email).first()
    finally:
        db.close()

def test_role_protection():
    # unique emails
    email_user = f"user{int(time.time())}@example.com"
    email_admin = f"admin{int(time.time())}@example.com"
    pw = "Pass123!"

    # register both users
    r = client.post("/auth/register", json={"email": email_user, "password": pw, "role": "user"})
    assert r.status_code == 200
    r = client.post("/auth/register", json={"email": email_admin, "password": pw, "role": "admin"})
    assert r.status_code == 200

    # get them from DB
    u_user = _get_user(email_user)
    u_admin = _get_user(email_admin)
    assert u_user and u_admin

    # generate tokens directly (bypass OTP for test)
    t_user = create_access_token(subject=str(u_user.id), data={"email": u_user.email, "role": u_user.role})
    t_admin = create_access_token(subject=str(u_admin.id), data={"email": u_admin.email, "role": u_admin.role})

    # me endpoint
    r = client.get("/rbac/me", headers={"Authorization": f"Bearer {t_user}"})
    assert r.status_code == 200 and r.json()["role"] == "user"

    r = client.get("/rbac/me", headers={"Authorization": f"Bearer {t_admin}"})
    assert r.status_code == 200 and r.json()["role"] == "admin"

    # user tries to access admin-only -> 403
    r = client.get("/rbac/admin-only", headers={"Authorization": f"Bearer {t_user}"})
    assert r.status_code == 403

    # admin accesses admin-only -> 200
    r = client.get("/rbac/admin-only", headers={"Authorization": f"Bearer {t_admin}"})
    assert r.status_code == 200

    # user tries analyst-or-admin -> 403
    r = client.get("/rbac/analyst-or-admin", headers={"Authorization": f"Bearer {t_user}"})
    assert r.status_code == 403

    # admin can access analyst-or-admin -> 200
    r = client.get("/rbac/analyst-or-admin", headers={"Authorization": f"Bearer {t_admin}"})
    assert r.status_code == 200
