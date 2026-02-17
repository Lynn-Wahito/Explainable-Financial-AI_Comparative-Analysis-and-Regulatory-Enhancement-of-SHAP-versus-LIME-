# scripts/seed_users.py
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.src.db import SessionLocal, Base, engine
from backend.src.auth.models import User
from backend.src.auth.utils import hash_password

def ensure_tables():
    Base.metadata.create_all(bind=engine)

def upsert_user(email, password, role, is_verified=True):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                hashed_password=hash_password(password),
                role=role,
                is_verified=is_verified
            )
            db.add(u)
        else:
            u.role = role
            u.hashed_password = hash_password(password)
            u.is_verified = is_verified
        db.commit()
        print(f"Seeded: {email} ({role})")
    finally:
        db.close()

if __name__ == "__main__":
    ensure_tables()
    # Default dev accounts
    upsert_user("admin@example.com",    "Pass123!", "admin")
    upsert_user("customer@example.com", "Pass123!", "customer")
    upsert_user("analyst@example.com",  "Pass123!", "analyst")
    upsert_user("regulator@example.com","Pass123!", "regulator")
