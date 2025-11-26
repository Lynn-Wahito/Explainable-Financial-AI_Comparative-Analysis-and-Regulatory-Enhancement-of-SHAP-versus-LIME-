# backend/src/customer/limit.py
from sqlalchemy.orm import Session
from ..payments.models import Payment

def compute_credit_limit(user_id: int, db: Session) -> float:
    """
    Demo formula:
      base = 30,000
      + 0.8 * avg_on_time_payment * min(6, on_time_months)
      - 0.5 * avg_due * late_months
      - 1.0 * avg_due * missed_months
      floor at 10,000 and cap at 300,000
    """
    rows = db.query(Payment).filter(Payment.user_id == user_id).all()
    if not rows:
        return 30000.0

    total_months = len(rows)
    on_time = sum(1 for r in rows if r.status == "on_time")
    late = sum(1 for r in rows if r.status == "late")
    missed = sum(1 for r in rows if r.status == "missed")

    avg_due = (sum(r.due_amount for r in rows) / max(1, total_months))
    avg_on_time_payment = (
        sum(r.paid_amount for r in rows if r.status == "on_time") / max(1, on_time)
        if on_time else 0.0
    )

    base = 30000.0
    bonus = 0.8 * avg_on_time_payment * min(6, on_time)
    penalty = 0.5 * avg_due * late + 1.0 * avg_due * missed

    limit = base + bonus - penalty
    limit = max(10000.0, min(300000.0, limit))
    return float(round(limit, 2))
