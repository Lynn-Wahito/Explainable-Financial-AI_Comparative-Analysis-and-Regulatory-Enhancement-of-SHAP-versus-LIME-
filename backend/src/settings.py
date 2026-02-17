# backend/src/settings.py
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:
    def load_dotenv(*args, **kwargs):
        pass  # harmless no-op if python-dotenv is not installed

BASE_DIR = Path(__file__).resolve().parent.parent  # points to backend/
# Load backend/.env if present
load_dotenv(BASE_DIR / ".env")

# Comma-separated list string -> list
CORS_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if o.strip()
]

# Seed users who skip 2FA
AUTH_SEED_BYPASS_EMAILS = {
    e.strip().lower()
    for e in os.getenv("AUTH_SEED_BYPASS_EMAILS", "").split(",")
    if e.strip()
}
