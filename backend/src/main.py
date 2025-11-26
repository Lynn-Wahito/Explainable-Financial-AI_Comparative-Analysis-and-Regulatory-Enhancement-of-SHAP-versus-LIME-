# backend/src/main.py
from datetime import datetime
import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .db import engine, Base, SessionLocal

# --- import models BEFORE create_all() ---
from .auth import models as auth_models        # noqa: F401
from .core import models as core_models        # noqa: F401
from .customer import models as customer_models  # noqa: F401

# --- routers ---
from .auth import routes as auth_routes
from .auth import rbac_routes as admin_routes
from .ml import predict_api as ml_api
from .ml import routes as ml_misc
from .ml import xai_routes as ml_xai
from .customer import routes as customer_routes
from .analytics import routes as analytics_routes
from .analyst import routes as analyst_routes

try:
    from .settings import CORS_ORIGINS  # type: ignore
except Exception:
    CORS_ORIGINS = None

from dotenv import load_dotenv
load_dotenv()


# ---------------------------
# CORS (dev-safe)
# ---------------------------
DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

def _cors_origins() -> List[str]:
    if DEV_ORIGINS:
        return DEV_ORIGINS
    if isinstance(CORS_ORIGINS, (list, tuple)) and CORS_ORIGINS:
        return list(CORS_ORIGINS)
    env_val = os.getenv("CORS_ORIGINS", "")
    if env_val:
        parts = [p.strip() for p in env_val.replace(" ", ",").split(",") if p.strip()]
        if parts:
            return parts
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


app = FastAPI(title="Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*", "Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["*"],
    max_age=86400,
)


# ---------------------------
# SQLite schema patch helpers
# ---------------------------
def _ensure_table(db, name: str, create_sql: str) -> None:
    exists = db.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:n"),
        {"n": name},
    ).fetchone()
    if not exists:
        db.execute(text(create_sql))

def _add_missing_cols(db, table: str, wanted_cols: dict) -> None:
    cols = db.execute(text(f"PRAGMA table_info({table})")).mappings().all()
    have = {c["name"].lower() for c in cols}
    for name, sql_type in wanted_cols.items():
        if name.lower() not in have:
            db.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))

def _copy_if_exists(db, table: str, src_col: str, dst_col: str) -> None:
    cols = db.execute(text(f"PRAGMA table_info({table})")).mappings().all()
    names = {c["name"].lower() for c in cols}
    if src_col.lower() in names and dst_col.lower() in names:
        db.execute(text(f"UPDATE {table} SET {dst_col} = COALESCE({dst_col}, {src_col})"))

def _migrate_legacy_payment_status(db) -> None:
    cols = db.execute(text("PRAGMA table_info(payment_status)")).mappings().all()
    names = {c["name"].lower() for c in cols}
    if "month" in names and "month_index" in names:
        db.execute(text("UPDATE payment_status SET month_index = COALESCE(month_index, month)"))
    if "status" in names and "status_code" in names:
        db.execute(text("UPDATE payment_status SET status_code = COALESCE(status_code, status)"))

def _seed_payment_history_if_missing(db) -> None:
    try:
        user_rows = db.execute(text("SELECT id FROM users")).fetchall()
    except Exception:
        return

    for (uid,) in user_rows:
        has_ps = db.execute(
            text("SELECT 1 FROM payment_status WHERE user_id=:u LIMIT 1"),
            {"u": uid},
        ).fetchone()
        has_ba = db.execute(
            text("SELECT 1 FROM bill_amount WHERE user_id=:u LIMIT 1"),
            {"u": uid},
        ).fetchone()
        has_pa = db.execute(
            text("SELECT 1 FROM pay_amount WHERE user_id=:u LIMIT 1"),
            {"u": uid},
        ).fetchone()

        if has_ps and has_ba and has_pa:
            continue

        default_limit = 120_000
        base_bill = max(10_000, round(default_limit / 6))
        bills = [round(base_bill * (1 + (0.06 - i * 0.01))) for i in range(6)]
        pays = bills[:]
        statuses = [0, 1, 0, 2, 0, 0]
        pays[3] = round(bills[3] * 0.2)

        now = datetime.utcnow().isoformat(timespec="seconds")
        for i in range(6):  # 0 = most recent
            if not has_ps:
                db.execute(text("""
                    INSERT INTO payment_status (user_id, month_index, status_code, bill_amount, pay_amount, created_at)
                    VALUES (:u, :m, :s, :b, :p, :t)
                """), {"u": uid, "m": i, "s": statuses[i], "b": float(bills[i]), "p": float(pays[i]), "t": now})
            if not has_ba:
                db.execute(text("""
                    INSERT INTO bill_amount (user_id, month_index, amount, created_at)
                    VALUES (:u, :m, :a, :t)
                """), {"u": uid, "m": i, "a": float(bills[i]), "t": now})
            if not has_pa:
                db.execute(text("""
                    INSERT INTO pay_amount (user_id, month_index, amount, created_at)
                    VALUES (:u, :m, :a, :t)
                """), {"u": uid, "m": i, "a": float(pays[i]), "t": now})

def _ensure_bill_and_pay_tables(db) -> None:
    # bill_amount
    _ensure_table(db, "bill_amount", """
    CREATE TABLE IF NOT EXISTS bill_amount (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      month_index INTEGER,
      amount REAL,
      created_at TEXT
    )
    """)
    _add_missing_cols(db, "bill_amount", {
        "user_id": "INTEGER",
        "month_index": "INTEGER",
        "amount": "REAL",
        "created_at": "TEXT",
    })
    # migrate legacy aliases if present
    _copy_if_exists(db, "bill_amount", "bill", "amount")
    _copy_if_exists(db, "bill_amount", "value", "amount")
    _copy_if_exists(db, "bill_amount", "month", "month_index")
    _copy_if_exists(db, "bill_amount", "idx", "month_index")

    # pay_amount
    _ensure_table(db, "pay_amount", """
    CREATE TABLE IF NOT EXISTS pay_amount (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      month_index INTEGER,
      amount REAL,
      created_at TEXT
    )
    """)
    _add_missing_cols(db, "pay_amount", {
        "user_id": "INTEGER",
        "month_index": "INTEGER",
        "amount": "REAL",
        "created_at": "TEXT",
    })
    _copy_if_exists(db, "pay_amount", "pay", "amount")
    _copy_if_exists(db, "pay_amount", "value", "amount")
    _copy_if_exists(db, "pay_amount", "month", "month_index")
    _copy_if_exists(db, "pay_amount", "idx", "month_index")


def patch_schema() -> None:
    db = SessionLocal()
    try:
        # 1) Ensure loan_applications exists
        _ensure_table(db, "loan_applications", """
        CREATE TABLE IF NOT EXISTS loan_applications (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          full_name TEXT, email TEXT, national_id TEXT, phone TEXT,
          amount REAL, purpose TEXT, term_months INTEGER,
          education_level TEXT, marital_status TEXT, employment_status TEXT,
          annual_income REAL, housing_payment REAL, other_debt REAL,
          status TEXT, submitted_at TEXT, updated_at TEXT, analyst_report_id TEXT
        )
        """)
        _add_missing_cols(db, "loan_applications", {
            "user_id": "INTEGER",
            "full_name": "TEXT",
            "email": "TEXT",
            "national_id": "TEXT",
            "phone": "TEXT",
            "amount": "REAL",
            "purpose": "TEXT",
            "term_months": "INTEGER",
            "education_level": "TEXT",
            "marital_status": "TEXT",
            "employment_status": "TEXT",
            "annual_income": "REAL",
            "housing_payment": "REAL",
            "other_debt": "REAL",
            "status": "TEXT",
            "submitted_at": "TEXT",
            "updated_at": "TEXT",
            "analyst_report_id": "TEXT",
        })

        # 2) payment_status table + columns + legacy copy
        _ensure_table(db, "payment_status", """
        CREATE TABLE IF NOT EXISTS payment_status (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          month_index INTEGER,
          status_code INTEGER,
          bill_amount REAL,
          pay_amount REAL,
          created_at TEXT
        )
        """)
        _add_missing_cols(db, "payment_status", {
            "user_id": "INTEGER",
            "month_index": "INTEGER",
            "status_code": "INTEGER",
            "bill_amount": "REAL",
            "pay_amount": "REAL",
            "created_at": "TEXT",
        })
        _migrate_legacy_payment_status(db)

        # 3) bill_amount / pay_amount tables
        _ensure_bill_and_pay_tables(db)

        db.commit()

        # 4) Optional seed if empty
        _seed_payment_history_if_missing(db)
        db.commit()

    except Exception as e:
        print("[schema] patch skipped/error:", e)
        db.rollback()
    finally:
        db.close()


# ---------------------------
# Last-resort guard: run on first request
# ---------------------------
@app.middleware("http")
async def _ensure_schema_middleware(request, call_next):
    if not getattr(app.state, "schema_checked", False):
        try:
            with engine.begin() as conn:
                # Ensure bill_amount
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS bill_amount (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        month_index INTEGER,
                        amount REAL,
                        created_at TEXT
                    )
                """))
                cols = conn.execute(text("PRAGMA table_info(bill_amount)")).mappings().all()
                names = {c["name"].lower() for c in cols}
                if "month_index" not in names:
                    conn.execute(text("ALTER TABLE bill_amount ADD COLUMN month_index INTEGER"))
                if "amount" not in names:
                    conn.execute(text("ALTER TABLE bill_amount ADD COLUMN amount REAL"))
                if "created_at" not in names:
                    conn.execute(text("ALTER TABLE bill_amount ADD COLUMN created_at TEXT"))

                # Ensure pay_amount
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS pay_amount (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        month_index INTEGER,
                        amount REAL,
                        created_at TEXT
                    )
                """))
                cols2 = conn.execute(text("PRAGMA table_info(pay_amount)")).mappings().all()
                names2 = {c["name"].lower() for c in cols2}
                if "month_index" not in names2:
                    conn.execute(text("ALTER TABLE pay_amount ADD COLUMN month_index INTEGER"))
                if "amount" not in names2:
                    conn.execute(text("ALTER TABLE pay_amount ADD COLUMN amount REAL"))
                if "created_at" not in names2:
                    conn.execute(text("ALTER TABLE pay_amount ADD COLUMN created_at TEXT"))

                # Also ensure payment_status safety (already handled in startup)
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS payment_status (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        month_index INTEGER,
                        status_code INTEGER,
                        bill_amount REAL,
                        pay_amount REAL,
                        created_at TEXT
                    )
                """))
                cps = conn.execute(text("PRAGMA table_info(payment_status)")).mappings().all()
                pnames = {c["name"].lower() for c in cps}
                for col, typ in [
                    ("month_index", "INTEGER"),
                    ("status_code", "INTEGER"),
                    ("bill_amount", "REAL"),
                    ("pay_amount", "REAL"),
                    ("created_at", "TEXT"),
                ]:
                    if col not in pnames:
                        conn.execute(text(f"ALTER TABLE payment_status ADD COLUMN {col} {typ}"))

            app.state.schema_checked = True
            print("✅ bill_amount/pay_amount/payment_status columns ensured")
        except Exception as e:
            print("⚠️ schema check failed (will continue):", e)
    return await call_next(request)


# ---------------------------
# Mount routers
# ---------------------------
app.include_router(auth_routes.router)
app.include_router(admin_routes.router)
app.include_router(ml_api.router)
app.include_router(ml_misc.router)
app.include_router(ml_xai.router)         # /explain/shap /explain/lime
app.include_router(customer_routes.router)
app.include_router(analytics_routes.router)
app.include_router(analyst_routes.router)


# ---------------------------
# Lifecycle
# ---------------------------
@app.on_event("startup")
def on_startup() -> None:
    app.state.started_at = datetime.utcnow()
    Base.metadata.create_all(bind=engine)
    patch_schema()

    insp = inspect(engine)
    print("✅ Tables:", insp.get_table_names())
    print("✅ Routes:")
    for r in app.routes:
        try:
            print("   ", f"{','.join(sorted(getattr(r, 'methods', []) or [])):8s}", r.path)
        except Exception:
            pass


# ---------------------------
# Meta endpoints
# ---------------------------
@app.get("/", tags=["meta"])
def root():
    return {"msg": "Backend API running. See /docs", "version": app.version}

@app.get("/healthz", tags=["meta"])
def healthz():
    return {"status": "ok", "started_at": getattr(app.state, "started_at", None)}

@app.get("/__ping__", tags=["meta"])
def ping():
    return {"ok": True, "ts": datetime.utcnow().isoformat(timespec="seconds")}
