#backend\src\customer\routes.py
import os
import random
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db import SessionLocal
from ..auth.models import User
from ..auth.utils import get_current_user
from .models import LoanApplication

# Optional ORM models for history (we can work without them)
try:
    from .models import BillAmount, PaymentAmount, PaymentStatus
except Exception:
    BillAmount = PaymentAmount = PaymentStatus = None

# Optional httpx for calling local ML / XAI services
try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None

router = APIRouter(prefix="/customer", tags=["customer"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------
# Helpers for history (legacy DB history)
# ---------------------------
def _fetch_series(db: Session, user_id: int, table: str, value_col: str) -> List[Tuple[int, float]]:
    rows = db.execute(
        text(f"""
            SELECT month_index AS m, COALESCE({value_col}, 0) AS v
            FROM {table}
            WHERE user_id = :u
            ORDER BY m ASC
        """),
        {"u": user_id},
    ).fetchall()
    out: List[Tuple[int, float]] = []
    for m, v in rows:
        try:
            out.append((int(m), float(v)))
        except Exception:
            continue
    return out


def _history_summary(db: Session, user_id: int) -> Dict[str, Any]:
    pay_codes = [0, 0, 0, 0, 0, 0]
    bill_amts = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
    pay_amts  = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

    if PaymentStatus and BillAmount and PaymentAmount:
        sts = (
            db.query(PaymentStatus)
            .filter(PaymentStatus.user_id == user_id)
            .order_by(PaymentStatus.month_index.asc())
            .all()
        )
        bals = (
            db.query(BillAmount)
            .filter(BillAmount.user_id == user_id)
            .order_by(BillAmount.month_index.asc())
            .all()
        )
        pays = (
            db.query(PaymentAmount)
            .filter(PaymentAmount.user_id == user_id)
            .order_by(PaymentAmount.month_index.asc())
            .all()
        )

        for r in sts:
            idx = int(getattr(r, "month_index", 0)) - 1
            if 0 <= idx < 6:
                pay_codes[idx] = int(getattr(r, "status_code", getattr(r, "status", 0)) or 0)
        for r in bals:
            idx = int(getattr(r, "month_index", 0)) - 1
            if 0 <= idx < 6:
                bill_amts[idx] = float(getattr(r, "amount", 0.0) or 0.0)
        for r in pays:
            idx = int(getattr(r, "month_index", 0)) - 1
            if 0 <= idx < 6:
                pay_amts[idx] = float(getattr(r, "amount", 0.0) or 0.0)
    else:
        for m, v in _fetch_series(db, user_id, "bill_amount", "amount"):
            idx = m - 1
            if 0 <= idx < 6:
                bill_amts[idx] = v

        for m, v in _fetch_series(db, user_id, "pay_amount", "amount"):
            idx = m - 1
            if 0 <= idx < 6:
                pay_amts[idx] = v

        rows = db.execute(
            text("""
                SELECT month_index AS m, COALESCE(status_code, 0) AS s
                FROM payment_status
                WHERE user_id = :u
                ORDER BY m ASC
            """),
            {"u": user_id},
        ).fetchall()
        for m, s in rows:
            try:
                idx = int(m) - 1
                sc = int(s)
            except Exception:
                continue
            if 0 <= idx < 6:
                pay_codes[idx] = sc

    return {
        "pay_codes": pay_codes,
        "bill_amts": bill_amts,
        "pay_amts":  pay_amts,
    }


def _compute_credit_limit(summary: Dict[str, Any]) -> float:
    base = 75_000.0
    pay = summary.get("pay_codes", []) or []
    on_time = sum(1 for x in pay if x <= 0)
    late    = sum(1 for x in pay if x in (1, 2))
    severe  = sum(1 for x in pay if x >= 3)

    limit = base + on_time * 2500 - late * 5000 - severe * 15000
    limit = max(20_000.0, min(limit, 500_000.0))
    return float(limit)


# ---------------------------
# UCI dataset helpers (per-user assignment)
# ---------------------------
def _get_uci_df() -> pd.DataFrame:
    """
    Load the UCI Credit Card dataset (XLS or CSV), normalise column names,
    and map X1..X23 to the standard UCI field names so that later calls
    to row.get("LIMIT_BAL"), row.get("BILL_AMT1"), etc. actually work.
    """

    # Project root: ...\Explainable-Financial-AI_...\  (one level above 'backend')
    project_root = Path(__file__).resolve().parents[3]

    # Default path: D:\...\Explainable-Financial-AI-\data\UCI_Credit_Card.xls
    default_path = project_root / "data" / "UCI_Credit_Card.xls"
    data_path_str = os.getenv("UCI_CREDIT_PATH", str(default_path))
    data_path = Path(data_path_str)

    if not data_path.exists():
        raise RuntimeError(f"UCI dataset not found at: {data_path}")

    ext = data_path.suffix.lower()

    if ext in {".xls", ".xlsx"}:
        # Read Excel
        df = pd.read_excel(data_path)
    else:
        # Fallback for CSV if you ever switch back
        df = pd.read_csv(
            data_path,
            engine="python",
            sep=None,
            encoding="utf-8-sig",
        )

    # -------- NORMALISE COLUMN NAMES (strip, upper, replace spaces with _) --------
    norm_cols = []
    for c in df.columns:
        c_str = str(c)
        c_norm = c_str.strip().upper().replace(" ", "_")
        norm_cols.append(c_norm)

    df.columns = norm_cols

    # -------- MAP X1..X23 TO STANDARD UCI NAMES --------
    # Your Excel shows columns like: UNNAMED:_0, X1, X2, ..., X19, ...
    # This mapping follows the original UCI Credit Card description:
    col_map = {
        # Basic profile
        "X1": "LIMIT_BAL",
        "X2": "SEX",
        "X3": "EDUCATION",
        "X4": "MARRIAGE",
        "X5": "AGE",

        # Repayment status
        "X6": "PAY_0",
        "X7": "PAY_2",
        "X8": "PAY_3",
        "X9": "PAY_4",
        "X10": "PAY_5",
        "X11": "PAY_6",

        # Bill amounts
        "X12": "BILL_AMT1",
        "X13": "BILL_AMT2",
        "X14": "BILL_AMT3",
        "X15": "BILL_AMT4",
        "X16": "BILL_AMT5",
        "X17": "BILL_AMT6",

        # Payment amounts
        "X18": "PAY_AMT1",
        "X19": "PAY_AMT2",
        "X20": "PAY_AMT3",
        "X21": "PAY_AMT4",
        "X22": "PAY_AMT5",
        "X23": "PAY_AMT6",

        # Default label (depending on your version, might be X24 or already Y)
        "X24": "Y",
    }

    df = df.rename(columns=col_map)

    # Drop index-like unnamed column if present
    df = df.drop(
        columns=[c for c in df.columns if c.startswith("UNNAMED")],
        errors="ignore",
    )

    # Debug: show first few normalised columns so we see what we have
    print("DEBUG UCI COLUMNS (first 20):", list(df.columns[:20]))

    return df.reset_index(drop=True)


def _ensure_assignment_table(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_uci_assignment (
              user_id      INTEGER PRIMARY KEY,
              uci_row_idx  INTEGER NOT NULL
            )
            """
        )
    )
    db.commit()


def _normalize_row_keys(row: Dict[str, Any]) -> Dict[str, Any]:
    return {str(k).strip().upper(): v for k, v in row.items()}


def _limit_balance_from_uci_row(row: Dict[str, Any]) -> float:
    upper = _normalize_row_keys(row)
    for key in ("LIMIT_BAL", "LIMIT_BALANCE", "LIMIT", "LIMIT BAL"):
        if key in upper:
            v = upper[key]
            try:
                if v is None or (isinstance(v, float) and pd.isna(v)):
                    continue
                return float(v)
            except Exception:
                continue
    return 0.0


def _assign_uci_row_to_user(db: Session, user_id: int, is_seed: bool = False) -> Dict[str, Any]:
    if is_seed:
        return {}

    _ensure_assignment_table(db)
    df = _get_uci_df()

    existing = db.execute(
        text("SELECT uci_row_idx FROM user_uci_assignment WHERE user_id = :uid"),
        {"uid": user_id},
    ).mappings().first()

    if existing is None:
        idx = random.randint(0, len(df) - 1)
        db.execute(
            text(
                "INSERT INTO user_uci_assignment (user_id, uci_row_idx) VALUES (:uid, :idx)"
            ),
            {"uid": user_id, "idx": idx},
        )
        db.commit()
    else:
        idx = existing["uci_row_idx"]

    row = df.iloc[idx].to_dict()

    try:
        upper = _normalize_row_keys(row)
        print(
            "DEBUG UCI ROW ASSIGNED:",
            idx,
            {
                "LIMIT_BAL": upper.get("LIMIT_BAL"),
                "PAY_0": upper.get("PAY_0"),
                "BILL_AMT1": upper.get("BILL_AMT1"),
                "PAY_AMT1": upper.get("PAY_AMT1"),
            },
            flush=True,
        )
    except Exception:
        pass

    return row


def _history_from_uci_row(row: Dict[str, Any]) -> Dict[str, Any]:
    upper = _normalize_row_keys(row)

    def _num(v, default=0.0):
        try:
            if v is None or (isinstance(v, float) and pd.isna(v)):
                return default
            return float(v)
        except Exception:
            return default

    def _icode(key: str, default: int = 0) -> int:
        v = upper.get(key, default)
        try:
            if v is None or (isinstance(v, float) and pd.isna(v)):
                return default
            return int(v)
        except Exception:
            return default

    pay_codes = [
        _icode("PAY_0", 0),
        _icode("PAY_2", 0),
        _icode("PAY_3", 0),
        _icode("PAY_4", 0),
        _icode("PAY_5", 0),
        _icode("PAY_6", 0),
    ]

    bill_amts = [
        _num(upper.get("BILL_AMT1", 0.0)),
        _num(upper.get("BILL_AMT2", 0.0)),
        _num(upper.get("BILL_AMT3", 0.0)),
        _num(upper.get("BILL_AMT4", 0.0)),
        _num(upper.get("BILL_AMT5", 0.0)),
        _num(upper.get("BILL_AMT6", 0.0)),
    ]

    pay_amts = [
        _num(upper.get("PAY_AMT1", 0.0)),
        _num(upper.get("PAY_AMT2", 0.0)),
        _num(upper.get("PAY_AMT3", 0.0)),
        _num(upper.get("PAY_AMT4", 0.0)),
        _num(upper.get("PAY_AMT5", 0.0)),
        _num(upper.get("PAY_AMT6", 0.0)),
    ]

    return {
        "pay_codes": pay_codes,
        "bill_amts": bill_amts,
        "pay_amts": pay_amts,
    }


# ---------------------------
# Model feature mapping (same logic as analyst side)
# ---------------------------
def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        if val is None:
            return float(default)
        return float(val)
    except Exception:
        return float(default)


def _map_application_to_features(
    app: LoanApplication,
    hist: Optional[Dict[str, Any]] = None,
    credit_limit: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Map a LoanApplication row directly into the UCI model feature space.
    This mirrors the logic in backend/src/analyst/routes.py so that
    analyst and customer views remain consistent.
    """

    # Core numeric inputs from the application table
    amount = _safe_float(getattr(app, "amount", None), 0.0)
    income = _safe_float(getattr(app, "annual_income", None), 0.0)
    annual_income = income
    other_debt = _safe_float(getattr(app, "other_debt", None), 0.0)
    housing_payment = _safe_float(getattr(app, "housing_payment", None), 0.0)
    term_months = _safe_float(getattr(app, "term_months", None), 12.0)

    # --- LIMIT_BAL heuristic ---
    if annual_income > 0:
        limit_bal = max(amount, 0.2 * annual_income)
    else:
        limit_bal = amount if amount > 0 else 50_000.0

    # --- Demographics ---
    sex = 2.0  # default female
    education = 3.0
    edu_txt = (getattr(app, "education_level", "") or "").lower()
    if "univ" in edu_txt or "degree" in edu_txt or "bsc" in edu_txt:
        education = 2.0
    elif "post" in edu_txt or "masters" in edu_txt or "msc" in edu_txt:
        education = 1.0
    elif "primary" in edu_txt:
        education = 4.0

    marriage = 3.0
    mar_txt = (getattr(app, "marital_status", "") or "").lower()
    if mar_txt.startswith("mar"):
        marriage = 1.0
    elif mar_txt.startswith("sing"):
        marriage = 2.0

    age = 35.0  # safe constant for demo

    # --- Repayment status based on debt-to-income ---
    dti = 0.0
    if annual_income > 0:
        dti = (other_debt) / annual_income

    pay_0 = 0.0
    if dti > 0.9:
        pay_0 = 2.0
    elif dti > 0.6:
        pay_0 = 1.0

    pay_2 = pay_3 = pay_4 = pay_5 = pay_6 = 0.0

    # --- Bill amounts ---
    bill_amt1 = amount
    bill_amt2 = max(0.0, amount * 0.9)
    bill_amt3 = max(0.0, amount * 0.8)
    bill_amt4 = max(0.0, amount * 0.7)
    bill_amt5 = max(0.0, amount * 0.6)
    bill_amt6 = max(0.0, amount * 0.5)

    # --- Payment amounts ---
    base_pay = housing_payment if housing_payment > 0 else (amount / max(term_months, 1.0)) * 0.3
    if base_pay < 0:
        base_pay = 0.0

    pay_amt1 = base_pay
    pay_amt2 = base_pay
    pay_amt3 = base_pay
    pay_amt4 = base_pay + (other_debt / 6.0 if other_debt > 0 else 0.0)
    pay_amt5 = base_pay
    pay_amt6 = base_pay

    return {
        "LIMIT_BAL": float(limit_bal),
        "SEX": float(sex),
        "EDUCATION": float(education),
        "MARRIAGE": float(marriage),
        "AGE": float(age),
        "PAY_0": float(pay_0),
        "PAY_2": float(pay_2),
        "PAY_3": float(pay_3),
        "PAY_4": float(pay_4),
        "PAY_5": float(pay_5),
        "PAY_6": float(pay_6),
        "BILL_AMT1": float(bill_amt1),
        "BILL_AMT2": float(bill_amt2),
        "BILL_AMT3": float(bill_amt3),
        "BILL_AMT4": float(bill_amt4),
        "BILL_AMT5": float(bill_amt5),
        "BILL_AMT6": float(bill_amt6),
        "PAY_AMT1": float(pay_amt1),
        "PAY_AMT2": float(pay_amt2),
        "PAY_AMT3": float(pay_amt3),
        "PAY_AMT4": float(pay_amt4),
        "PAY_AMT5": float(pay_amt5),
        "PAY_AMT6": float(pay_amt6),
    }


def _heuristic_score(app: LoanApplication) -> float:
    """
    Simple fallback probability if ML service fails, using ONLY application fields.
    """
    p = 0.2
    try:
        annual_income = _safe_float(getattr(app, "annual_income", None), 0.0)
        other_debt = _safe_float(getattr(app, "other_debt", None), 0.0)
        amount = _safe_float(getattr(app, "amount", None), 0.0)

        if annual_income > 0:
            dti = (other_debt + amount) / annual_income
            if dti > 0.9:
                p += 0.4
            elif dti > 0.6:
                p += 0.25
            elif dti > 0.4:
                p += 0.1
            else:
                p -= 0.05
    except Exception:
        pass

    p = max(0.01, min(p, 0.99))
    return float(p)


# ---- Schemas ----
class LoanApplicationIn(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    national_id: Optional[str] = None
    phone: Optional[str] = None

    amount: float = Field(..., gt=0)
    purpose: str
    term_months: int = Field(..., gt=0)

    education_level: Optional[str] = None
    marital_status: Optional[str] = None
    employment_status: str
    annual_income: float = Field(..., ge=0)
    housing_payment: float = Field(..., ge=0)
    other_debt: float = Field(..., ge=0)


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: Optional[int] = None
    amount: Optional[float] = None
    purpose: Optional[str] = None
    status: Optional[str] = "Pending"
    submitted: Optional[str] = None


class DashboardOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    profile: dict
    credit: dict
    applications: List[ApplicationOut] = []


def _map_app_for_response(a) -> ApplicationOut:
    created = getattr(a, "submitted_at", None) or getattr(a, "created_at", None) or datetime.utcnow()
    return ApplicationOut(
        id=getattr(a, "id", None),
        amount=getattr(a, "amount", None),
        purpose=getattr(a, "purpose", None),
        status=(getattr(a, "status", None) or "Pending").title(),
        submitted=created.strftime("%b %d, %Y, %H:%M"),
    )


# ---------------------------
# DASHBOARD
# ---------------------------
@router.get("/dashboard", response_model=DashboardOut)
def customer_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    role = getattr(user, "role", None)
    profile = {
        "id": user.id,
        "email": user.email,
        "name": user.full_name or user.email.split("@")[0].title(),
        "role": role.value if getattr(role, "value", None) else (str(role) if role else None),
    }

    q = db.query(LoanApplication).filter(LoanApplication.user_id == user.id)
    if hasattr(LoanApplication, "submitted_at"):
        q = q.order_by(LoanApplication.submitted_at.desc())
    rows = q.limit(20).all()
    apps = [_map_app_for_response(r) for r in rows]

    is_seed = getattr(user, "is_seed", False)
    uci_row = _assign_uci_row_to_user(db, user.id, is_seed=is_seed)
    if uci_row:
        hist = _history_from_uci_row(uci_row)
        credit_limit = _limit_balance_from_uci_row(uci_row)
        if credit_limit <= 0:
            credit_limit = _compute_credit_limit(hist)
    else:
        hist = _history_summary(db, user.id)
        credit_limit = _compute_credit_limit(hist)

    credit = {
        "pending_count": sum(1 for a in apps if (a.status or "").lower() in {"pending", "in review", "under review"}),
        "approved_count": sum(1 for a in apps if (a.status or "").lower() == "approved"),
        "total_limit": credit_limit,
    }

    return {"profile": profile, "credit": credit, "applications": apps}


# ---------------------------
# LIST MY APPLICATIONS
# ---------------------------
@router.get("/applications", response_model=List[ApplicationOut])
def list_my_applications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(LoanApplication).filter(LoanApplication.user_id == user.id)
    if hasattr(LoanApplication, "submitted_at"):
        q = q.order_by(LoanApplication.submitted_at.desc())
    rows = q.limit(100).all()
    return [_map_app_for_response(r) for r in rows]


# ---------------------------
# PREFILL
# ---------------------------
@router.get("/apply/prefill")
def apply_prefill(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    is_seed = getattr(user, "is_seed", False)
    uci_row = _assign_uci_row_to_user(db, user.id, is_seed=is_seed)

    if uci_row:
        history_summary = _history_from_uci_row(uci_row)
        credit_limit = _limit_balance_from_uci_row(uci_row)
        if credit_limit <= 0:
            credit_limit = _compute_credit_limit(history_summary)
    else:
        history_summary = _history_summary(db, user.id)
        credit_limit = _compute_credit_limit(history_summary)

    profile = {
        "full_name": user.full_name or user.email.split("@")[0].title(),
        "email": user.email,
        "employment_status": "Full-time Employed",
        "annual_income": 0.0,
        "housing_payment": 0.0,
        "other_debt": 0.0,
    }

    return {
        "profile": profile,
        "credit_limit": credit_limit,
        "limit_balance": credit_limit,
        "history_summary": history_summary,
        "uci_row": uci_row,
    }


# ---------------------------
# APPLY
# ---------------------------
@router.post("/apply")
def apply_for_loan(
    payload: LoanApplicationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    is_seed = getattr(user, "is_seed", False)
    uci_row = _assign_uci_row_to_user(db, user.id, is_seed=is_seed)
    if uci_row:
        hist = _history_from_uci_row(uci_row)
        credit_limit = _limit_balance_from_uci_row(uci_row)
        if credit_limit <= 0:
            credit_limit = _compute_credit_limit(hist)
    else:
        hist = _history_summary(db, user.id)
        credit_limit = _compute_credit_limit(hist)

    if payload.amount > credit_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Requested amount Ksh {payload.amount:,.0f} exceeds your credit limit Ksh {credit_limit:,.0f}."
        )

    full_name = payload.full_name or user.full_name
    email = payload.email or user.email

    app = LoanApplication(
        user_id=user.id,
        full_name=full_name,
        email=email,
        national_id=payload.national_id,
        phone=payload.phone,
        amount=payload.amount,
        purpose=payload.purpose,
        term_months=payload.term_months,
        education_level=payload.education_level,
        marital_status=payload.marital_status,
        employment_status=payload.employment_status,
        annual_income=payload.annual_income,
        housing_payment=payload.housing_payment,
        other_debt=payload.other_debt,
        status="pending",
        submitted_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    return {
        "message": "Application submitted successfully",
        "application": _map_app_for_response(app).model_dump(),
        "credit_limit": credit_limit,
    }


# ---------------------------
# CUSTOMER-FACING EXPLANATION ("Why this decision?")
# ---------------------------
@router.get("/applications/{app_id}/report")
def customer_application_report(
    app_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return a JSON explanation for the customer's application:
    - risk_score (probability of default)
    - risk_band (HIGH vs LOW/MODERATE)
    - SHAP and LIME top drivers (similar to analyst PDF)
    - simple strength / risk indicator bullet points
    """
    app: Optional[LoanApplication] = db.get(LoanApplication, app_id)
    if not app or int(app.user_id) != int(user.id):
        # Either not found or belongs to another user -> generic 404
        raise HTTPException(status_code=404, detail="Application not found")

    # history is not used directly in the features, but kept for future extensions
    hist = _history_summary(db, user.id)
    credit_limit = _compute_credit_limit(hist)

    features = _map_application_to_features(app, hist, credit_limit)

    # --- Predict default probability ---
    prob: Optional[float] = None
    if httpx is not None:
        try:
            r = httpx.post(
                "http://127.0.0.1:8000/ml/predict",
                json=features,
                timeout=6.0,
            )
            if r.status_code == 200:
                d = r.json()
                val = d.get("prob_default") or d.get("probability") or d.get("score")
                if val is not None:
                    prob = float(val)
        except Exception:
            prob = None

    if prob is None:
        prob = _heuristic_score(app)

    # --- Get SHAP + LIME contributions (top drivers) ---
    shap_pairs: List[Dict[str, Any]] = []
    lime_pairs: List[Dict[str, Any]] = []

    if httpx is not None:
        # SHAP
        try:
            s = httpx.post(
                "http://127.0.0.1:8000/ml/xai/shap",
                json={"features": features},
                timeout=6.0,
            )
            if s.status_code == 200:
                data = s.json()
                shap_pairs = (
                    data.get("contributions")
                    or data.get("explanations")
                    or data.get("pairs")
                    or []
                )
        except Exception:
            shap_pairs = []

        # LIME
        try:
            l = httpx.post(
                "http://127.0.0.1:8000/ml/xai/lime",
                json={"features": features},
                timeout=6.0,
            )
            if l.status_code == 200:
                data = l.json()
                lime_pairs = (
                    data.get("contributions")
                    or data.get("explanations")
                    or data.get("pairs")
                    or []
                )
        except Exception:
            lime_pairs = []

    # normalise and keep top drivers by |impact|
    def _normalise_pairs(pairs: List[Dict[str, Any]], k: int = 6) -> List[Dict[str, Any]]:
        out = []
        for p in pairs:
            name = p.get("feature") or p.get("name") or p.get("key") or "feature"
            weight = p.get("weight")
            if weight is None:
                weight = p.get("shap") or p.get("coeff") or 0.0
            value = p.get("value", features.get(name, None))
            try:
                w = float(weight)
            except Exception:
                w = 0.0
            out.append(
                {
                    "feature": str(name),
                    "value": value,
                    "impact": w,
                }
            )
        out.sort(key=lambda x: abs(x["impact"]), reverse=True)
        return out[:k]

    shap_top = _normalise_pairs(shap_pairs, k=6)
    lime_top = _normalise_pairs(lime_pairs, k=6)

    # --- simple strengths / risks from SHAP sign ---
    strengths: List[str] = []
    risks: List[str] = []
    for item in shap_top:
        feat = item["feature"]
        imp = float(item["impact"])
        if imp < 0:
            strengths.append(f"{feat} reduced your risk in this decision (impact {imp:+.2f}).")
        elif imp > 0:
            risks.append(f"{feat} increased your risk in this decision (impact {imp:+.2f}).")

    strengths = strengths[:5]
    risks = risks[:5]

    # --- risk band used in UI banner ---
    risk_band = "HIGH" if prob >= 0.6 else "LOW/MODERATE"

    return {
        "application_id": app.id,
        "status": app.status,
        "amount": app.amount,
        "risk_score": prob,
        "risk_band": risk_band,
        "model_name": "XGBoost credit default model",
        "strength_indicators": strengths,
        "risk_indicators": risks,
        "shap_top": shap_top,
        "lime_top": lime_top,
        "model_note": "Positive impact values push the predicted risk higher, negative values lower it.",
    }
