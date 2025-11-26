# backend/src/analytics/routes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from functools import lru_cache
from pydantic import BaseModel
import os, math, random

from ..db import SessionLocal

router = APIRouter(prefix="/analytics", tags=["analytics"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@lru_cache(maxsize=1)
def _load_pickle_model_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/src
    model_path = os.path.join(base, "..", "models", "xgb_credit.pkl")
    return os.path.normpath(model_path)


def _unwrap_estimator(obj):
    if isinstance(obj, dict):
        for k in ("model", "estimator", "clf", "classifier"):
            if k in obj:
                return obj[k]
    return obj


@lru_cache(maxsize=1)
def _load_estimator():
    import joblib, pickle
    p = _load_pickle_model_path()
    if not os.path.exists(p):
        raise RuntimeError(f"Model not found at {p}")
    try:
        obj = joblib.load(p)
    except Exception:
        with open(p, "rb") as f:
            obj = pickle.load(f)
    return _unwrap_estimator(obj)


def _table_columns(db: Session, table: str) -> set[str]:
    cols = []
    try:
        rows = db.execute(text(f"PRAGMA table_info({table})")).mappings().all()
        cols = [r["name"] for r in rows if "name" in r]
    except Exception:
        pass
    return set(c.lower() for c in cols)


def _order_expr(db: Session, table: str) -> str:
    cols = _table_columns(db, table)
    for c in ["submitted_at", "created_at", "updated_at", "id"]:
        if c in cols:
            return c
    return "ROWID"


# Priority table for analyst
@router.get("/priority")
def priority(db: Session = Depends(get_db)):
    sql = text(f"""
        SELECT
          la.id                                       AS app_id,
          COALESCE(la.full_name, u.full_name, u.email, 'Unknown') AS name,
          COALESCE(la.amount, 0)                      AS amount,
          LOWER(COALESCE(la.status, 'submitted'))     AS status
        FROM loan_applications la
        LEFT JOIN users u ON u.id = la.user_id
        ORDER BY COALESCE(la.{_order_expr(db,'loan_applications')}, la.id) DESC
        LIMIT 100
    """)
    rows = db.execute(sql).mappings().all()

    return [
        {
            "app_id": str(r["app_id"]),
            "name": r["name"] or "Unknown",
            "amount": float(r["amount"] or 0.0),
            "risk": None,
            "confidence": 0.0,
            "status": r["status"] or "submitted",
        }
        for r in rows
    ]


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    pending = db.execute(text("""
        SELECT COUNT(*) AS n FROM loan_applications
        WHERE LOWER(COALESCE(status,'submitted')) IN
            ('submitted','pending','for review','under review','in review','new')
    """)).scalar_one() or 0

    approved_today = db.execute(text("""
        SELECT COUNT(*) AS n FROM loan_applications
        WHERE LOWER(COALESCE(status,'')) IN ('approved','accepted')
          AND date(COALESCE(updated_at, submitted_at, CURRENT_TIMESTAMP)) = date('now')
    """)).scalar_one() or 0

    return {
        "pending_reviews": int(pending),
        "approved_today": int(approved_today),
        "high_risk_apps": 0,
        "ts": datetime.utcnow().isoformat() + "Z",
    }


# Decisions
class DecisionIn(BaseModel):
    status: str
    note: str | None = None


@router.post("/decision/{app_id}")
def set_decision(app_id: str, payload: DecisionIn, db: Session = Depends(get_db)):
    status = (payload.status or "").strip().lower()
    allowed = {"approved", "declined", "manual_review", "pending", "in review"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status}'")

    cols = _table_columns(db, "loan_applications")
    if "updated_at" in cols:
        db.execute(
            text("""UPDATE loan_applications
                    SET status=:s, updated_at=CURRENT_TIMESTAMP
                    WHERE id=:id"""),
            {"s": status, "id": app_id},
        )
    else:
        db.execute(
            text("UPDATE loan_applications SET status=:s WHERE id=:id"),
            {"s": status, "id": app_id},
        )
    db.commit()

    row = db.execute(
        text("SELECT id, COALESCE(status,'submitted') AS status FROM loan_applications WHERE id=:id"),
        {"id": app_id},
    ).mappings().first()

    return {"ok": True, "application_id": str(app_id), "status": row["status"] if row else status}
