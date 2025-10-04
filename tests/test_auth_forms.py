# tests/test_auth_forms.py
import time, os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from fastapi.testclient import TestClient
from backend.src.main import app

client = TestClient(app)

def test_register_and_login_returns_token():
    email = f"qa{int(time.time())}@example.com"
    password = "TestPass123!"
    r = client.post("/auth/register", json={"email": email, "password": password, "role": "user"})
    assert r.status_code == 200
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    assert "access_token" in r.json()
