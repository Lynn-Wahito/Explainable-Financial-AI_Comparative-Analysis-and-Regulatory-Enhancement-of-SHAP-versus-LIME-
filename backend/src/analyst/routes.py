# backend\src\analyst\routes.py
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

# Optional httpx for local ML + XAI proxy
try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None

# Optional reportlab for PDF; fall back to plain text PDF if missing
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
except Exception:  # pragma: no cover
    A4 = None
    canvas = None
    colors = None

from ..db import SessionLocal
from ..auth.models import User
from ..auth.utils import get_current_user
from ..customer.models import LoanApplication
from ..customer.routes import _history_summary, _compute_credit_limit  # still used for context only

router = APIRouter(prefix="/analyst", tags=["analyst"])


# ---------- DB + auth helpers ----------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _require_analyst(user: User):
    role = getattr(user, "role", None)
    role_val = getattr(role, "value", role)
    if str(role_val).upper() not in {"ANALYST", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Analyst access required")


# ---------- feature mapping helpers (NO HISTORY) ----------

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

    IMPORTANT:
    - We DO NOT rely on history arrays here anymore.
    - Everything is derived from the fields that exist on loan_applications.
    - This makes the analyst-side prediction stable and driven by the actual
      application data (amount, income, other_debt, etc.).
    """

    # Core numeric inputs from the application table
    amount = _safe_float(getattr(app, "amount", None), 0.0)
    income = _safe_float(getattr(app, "income", None), 0.0)
    annual_income = _safe_float(getattr(app, "annual_income", None), income)
    other_debt = _safe_float(getattr(app, "other_debt", None), 0.0)
    housing_payment = _safe_float(getattr(app, "housing_payment", None), 0.0)
    term_months = _safe_float(getattr(app, "term_months", None), 12.0)

    # --- LIMIT_BAL heuristic ---
    # Use amount as a base; if we know annual_income, cap it reasonably.
    if annual_income > 0:
        limit_bal = max(amount, 0.2 * annual_income)
    else:
        limit_bal = amount if amount > 0 else 50000.0  # basic fallback

    # --- Demographics from text fields ---
    # SEX: if we don't know, default to '2' (female) which is common in UCI
    sex = 2.0

    # EDUCATION: map from education_level text
    education = 3.0  # default = high school
    edu_txt = (getattr(app, "education_level", "") or "").lower()
    if "univ" in edu_txt or "degree" in edu_txt or "bsc" in edu_txt:
        education = 2.0  # university
    elif "post" in edu_txt or "masters" in edu_txt or "msc" in edu_txt:
        education = 1.0  # graduate school
    elif "primary" in edu_txt:
        education = 4.0  # others

    # MARRIAGE: from marital_status
    marriage = 3.0  # others
    mar_txt = (getattr(app, "marital_status", "") or "").lower()
    if mar_txt.startswith("mar"):
        marriage = 1.0
    elif mar_txt.startswith("sing"):
        marriage = 2.0

    # AGE: we do not store age; approximate with a safe constant for demo
    age = 35.0

    # --- Repayment status (no historical repayment -> assume current) ---
    dti = 0.0
    if annual_income > 0:
        dti = other_debt / annual_income

    pay_0 = 0.0
    if dti > 0.9:
        pay_0 = 2.0
    elif dti > 0.6:
        pay_0 = 1.0  # slightly overdue

    # No information for earlier months, keep them on-time
    pay_2 = 0.0
    pay_3 = 0.0
    pay_4 = 0.0
    pay_5 = 0.0
    pay_6 = 0.0

    # --- Bill amounts: use amount as a proxy spread over months ---
    bill_amt1 = amount
    bill_amt2 = max(0.0, amount * 0.9)
    bill_amt3 = max(0.0, amount * 0.8)
    bill_amt4 = max(0.0, amount * 0.7)
    bill_amt5 = max(0.0, amount * 0.6)
    bill_amt6 = max(0.0, amount * 0.5)

    # --- Payment amounts: housing_payment and other_debt as proxies ---
    base_pay = housing_payment if housing_payment > 0 else (amount / max(term_months, 1.0)) * 0.3
    if base_pay < 0:
        base_pay = 0.0

    pay_amt1 = base_pay
    pay_amt2 = base_pay
    pay_amt3 = base_pay
    pay_amt4 = base_pay + (other_debt / 6.0 if other_debt > 0 else 0.0)
    pay_amt5 = base_pay
    pay_amt6 = base_pay

    features = {
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

    # print("DEBUG ANALYST FEATURES FROM APP:", features)
    return features


def _heuristic_score(app: LoanApplication) -> Dict[str, Any]:
    """
    Simple fallback if ML service fails, using ONLY application fields.
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
    return {"prob_default": round(p, 4), "source": "heuristic"}


# ---------- endpoints ----------

@router.get("/applications")
def list_pending_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analyst(current_user)
    q = db.query(LoanApplication).order_by(LoanApplication.submitted_at.desc())
    rows = q.limit(200).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "amount": r.amount,
            "purpose": r.purpose,
            "status": r.status,
            "submitted_at": (getattr(r, "submitted_at", None) or datetime.utcnow()).isoformat(),
            "applicant": {"full_name": r.full_name, "email": r.email},
        }
        for r in rows
    ]


@router.post("/applications/{app_id}/analyze")
def analyze_application(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analyst(current_user)
    app: Optional[LoanApplication] = db.get(LoanApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # History / limit still computed for context (and report), but NOT used to build features.
    hist = _history_summary(db, app.user_id)
    credit_limit = _compute_credit_limit(hist)

    # NEW: build features ONLY from the application row
    features = _map_application_to_features(app, hist, credit_limit)

    # Prefer real model if available
    if httpx is not None:
        try:
            resp = httpx.post(
                "http://127.0.0.1:8000/ml/predict",
                #json={"features": features},
                json=features,
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                prob = (
                    data.get("prob_default")
                    or data.get("probability")
                    or data.get("score")
                )
                result = {
                    "used_model": "ml/predict",
                    "prob_default": round(float(prob or 0.0), 4),
                    "raw": data,
                }
            else:
                result = _heuristic_score(app)
        except Exception:
            result = _heuristic_score(app)
    else:
        result = _heuristic_score(app)

    return {
        "application_id": app.id,
        "features_used": features,
        "history": hist,
        "credit_limit": credit_limit,
        "result": result,
        "application_status": app.status,
    }


@router.post("/applications/{app_id}/status")
def update_application_status(
    app_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the decision status for a loan application.

    Allowed statuses:
      - approved
      - declined
      - manual_review
      - pending
    """
    _require_analyst(current_user)

    new_status_raw = payload.get("status")
    if not new_status_raw:
        raise HTTPException(status_code=400, detail="Missing status")

    new_status = str(new_status_raw).lower()
    allowed = {"approved", "declined", "manual_review", "pending"}
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")

    app: Optional[LoanApplication] = db.get(LoanApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.status = new_status
    db.commit()
    db.refresh(app)

    return {"id": app.id, "status": app.status}


# -------- Reports (REPORT FORMAT UPDATED BELOW) --------

# Pretty descriptions for SHAP/LIME tables
_FEATURE_DESCRIPTIONS: Dict[str, str] = {
    "LIMIT_BAL": "Maximum credit available",
    "BILL_AMT1": "Billing amount last month",
    "BILL_AMT2": "Billing amount two months ago",
    "BILL_AMT3": "Billing amount three months ago",
    "BILL_AMT4": "Billing amount four months ago",
    "BILL_AMT5": "Billing amount five months ago",
    "BILL_AMT6": "Billing amount six months ago",
    "PAY_0": "Most recent payment status",
    "PAY_2": "Payment status two months ago",
    "PAY_3": "Payment status three months ago",
    "PAY_4": "Payment status four months ago",
    "PAY_5": "Payment status five months ago",
    "PAY_6": "Payment status six months ago",
    "PAY_AMT1": "Payment amount last month",
    "PAY_AMT2": "Payment amount two months ago",
    "PAY_AMT3": "Payment amount three months ago",
    "PAY_AMT4": "Payment amount four months ago",
    "PAY_AMT5": "Payment amount five months ago",
    "PAY_AMT6": "Payment amount six months ago",
}


def _risk_label(prob: Optional[float]) -> str:
    if prob is None:
        return "N/A"
    if prob < 0.3:
        return "LOW"
    if prob < 0.6:
        return "MODERATE"
    return "HIGH"


def _build_risk_bullets(
    prob: Optional[float],
) -> tuple[List[str], List[str]]:
    """
    Simple heuristic bullets for the overview section.
    """
    strengths: List[str] = []
    risks: List[str] = []

    if prob is None:
        strengths.append("Model score unavailable; using heuristic assessment.")
        risks.append("Insufficient model information for precise risk estimate.")
        return strengths, risks

    pct = prob * 100.0
    label = _risk_label(prob)

    strengths.append(f"Model estimates default risk at about {pct:.0f}% ({label}).")

    if prob < 0.3:
        strengths.append("Overall credit profile appears stable and manageable.")
        strengths.append("Current obligations seem affordable relative to income.")
        risks.append("Future changes in income or expenses may increase default risk.")
    elif prob < 0.6:
        strengths.append("Credit behaviour shows a mix of positive and neutral signals.")
        risks.append("Moderate probability of default; monitoring is recommended.")
        risks.append("Some indicators suggest slightly elevated repayment pressure.")
    else:
        strengths.append("Some positive factors exist but are outweighed by risk drivers.")
        risks.append("High probability of default predicted by the model.")
        risks.append("Repayment capacity appears strained under current conditions.")

    return strengths, risks


def _normalise_pairs(pairs: List[Dict[str, Any]], top_n: int = 6) -> List[Dict[str, Any]]:
    data = []
    for p in pairs or []:
        weight = p.get("weight") or p.get("shap") or p.get("coeff") or 0.0
        try:
            w = float(weight)
        except Exception:
            w = 0.0
        name = p.get("feature") or p.get("name") or p.get("key") or "feature"
        value = p.get("value", 0)
        try:
            v = float(value)
        except Exception:
            v = 0.0
        data.append(
            {
                "feature": str(name),
                "value": v,
                "weight": w,
            }
        )
    data.sort(key=lambda d: abs(d["weight"]), reverse=True)
    return data[:top_n]


def _pdf_bytes(
    app: LoanApplication,
    prob: float | None,
    top_left: List[Dict[str, Any]] | None,
    top_right: List[Dict[str, Any]] | None,
) -> bytes:
    """
    Generate a one-page PDF styled like a Credit Risk Analysis report.

    Uses reportlab if available; otherwise returns a simple text fallback.
    """
    buf = BytesIO()

    if not (canvas and A4):
        # Fallback simple text "PDF"
        text = (
            f"CreditAI Analysis Report\n"
            f"Application ID: {app.id}\n"
            f"Applicant: {app.full_name or app.email}\n"
            f"Amount: Ksh {int(app.amount or 0):,}\n"
            f"Model Probability (risky): "
            f"{(prob * 100):.1f}%\n" if prob is not None else "Model Probability: N/A\n"
        )
        buf.write(text.encode("utf-8"))
        return buf.getvalue()

    from textwrap import wrap

    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    risk_pct = prob * 100.0 if prob is not None else None
    risk_label = _risk_label(prob)
    status = (app.status or "PENDING").upper()

    shap_rows = _normalise_pairs(top_left or [], top_n=6)
    lime_rows = _normalise_pairs(top_right or [], top_n=6)

    # HEADER BAR
    header_height = 70
    c.setFillColor(colors.HexColor("#0b3a82"))
    c.rect(0, h - header_height, w, header_height, stroke=0, fill=1)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, h - 40, "CREDIT RISK ANALYSIS")

    c.setFont("Helvetica", 8)
    c.drawString(40, h - 54, "CreditAI Automated Assessment System")

    # Application ID on top right
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - 40, h - 32, "Application ID")
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(w - 40, h - 52, f"{app.id}")

    # INFO ROW under header
    info_top = h - header_height - 20
    box_h = 38
    col_w = (w - 80) / 4.0
    labels = ["APPLICANT", "AMOUNT REQUESTED", "RISK SCORE", "STATUS"]
    values = [
        app.full_name or app.email or "—",
        f"Ksh {int(app.amount or 0):,}",
        (
            f"{risk_pct:.0f}% - {risk_label}"
            if risk_pct is not None
            else "—"
        ),
        status,
    ]

    for i in range(4):
        x0 = 40 + i * col_w
        c.setStrokeColor(colors.lightgrey)
        c.setFillColor(colors.white)
        c.rect(x0, info_top - box_h, col_w, box_h, stroke=1, fill=1)
        c.setFillColor(colors.HexColor("#808080"))
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x0 + 6, info_top - 12, labels[i])
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 9)
        c.drawString(x0 + 6, info_top - 24, str(values[i]))

    y = info_top - box_h - 18

    # 01 RISK ASSESSMENT OVERVIEW
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#0b3a82"))
    c.drawString(40, y, "01")
    c.setFillColor(colors.black)
    c.drawString(64, y, "RISK ASSESSMENT OVERVIEW")
    y -= 8

    strengths, risks = _build_risk_bullets(prob)

    # two side-by-side boxes
    y_box_top = y - 10
    box_width = (w - 80) / 2.0
    box_height = 80

    # Strength box
    c.setStrokeColor(colors.lightgrey)
    c.setFillColor(colors.white)
    c.rect(40, y_box_top - box_height, box_width, box_height, stroke=1, fill=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#057f3b"))
    c.drawString(48, y_box_top - 12, "STRENGTH INDICATORS")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 7)
    yy = y_box_top - 24
    for s_text in strengths[:5]:
        c.drawString(52, yy, f"- {s_text}")
        yy -= 10

    # Risk box
    x_right = 40 + box_width + 10
    c.setStrokeColor(colors.lightgrey)
    c.setFillColor(colors.white)
    c.rect(x_right, y_box_top - box_height, box_width, box_height, stroke=1, fill=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#b3261e"))
    c.drawString(x_right + 8, y_box_top - 12, "RISK INDICATORS")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 7)
    yy = y_box_top - 24
    for r_text in risks[:5]:
        c.drawString(x_right + 12, yy, f"- {r_text}")
        yy -= 10

    y = y_box_top - box_height - 20

    # 02 SHAP FEATURE ANALYSIS
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#0b3a82"))
    c.drawString(40, y, "02")
    c.setFillColor(colors.black)
    c.drawString(64, y, "SHAP FEATURE ANALYSIS")
    y -= 14

    # SHAP table
    def draw_feature_table(start_y: float, rows: List[Dict[str, Any]], is_shap: bool):
        col_x_feature = 40
        col_x_desc = 150
        col_x_val = 320
        col_x_impact = 400
        col_x_score = 460

        # header row
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(colors.HexColor("#f0f0f0"))
        c.rect(col_x_feature, start_y - 14, w - 80, 14, stroke=0, fill=1)
        c.setFillColor(colors.black)
        c.drawString(col_x_feature + 4, start_y - 10, "Feature")
        c.drawString(col_x_desc + 4, start_y - 10, "Description")
        c.drawString(col_x_val + 4, start_y - 10, "Value")
        c.drawString(col_x_impact + 4, start_y - 10, "Impact")
        c.drawString(col_x_score + 4, start_y - 10, "SHAP" if is_shap else "LIME")

        y_row = start_y - 20
        c.setFont("Helvetica", 7)
        for r in rows:
            feature = r["feature"]
            desc = _FEATURE_DESCRIPTIONS.get(feature, "")
            val = r["value"]
            wgt = r["weight"]

            c.setFillColor(colors.white)
            c.rect(col_x_feature, y_row - 12, w - 80, 12, stroke=0, fill=1)

            c.setFillColor(colors.black)
            c.drawString(col_x_feature + 4, y_row - 9, str(feature))
            if desc:
                c.drawString(col_x_desc + 4, y_row - 9, desc)
            c.drawRightString(col_x_val + 40, y_row - 9, f"{val:,.0f}")

            # impact arrow box
            if wgt >= 0:
                c.setFillColor(colors.HexColor("#ffebee"))
                arrow = "↑"
            else:
                c.setFillColor(colors.HexColor("#e8f5e9"))
                arrow = "↓"
            c.rect(col_x_impact, y_row - 11, 18, 10, stroke=0, fill=1)
            c.setFillColor(colors.black)
            c.drawCentredString(col_x_impact + 9, y_row - 9, arrow)

            # numeric SHAP/LIME
            c.drawRightString(col_x_score + 40, y_row - 9, f"{wgt:+.2f}")
            y_row -= 12

        return y_row

    y = draw_feature_table(y, shap_rows, is_shap=True) - 14

    # 03 LIME FEATURE ANALYSIS
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#0b3a82"))
    c.drawString(40, y, "03")
    c.setFillColor(colors.black)
    c.drawString(64, y, "LIME FEATURE ANALYSIS")
    y -= 14

    y = draw_feature_table(y, lime_rows, is_shap=False) - 10

    # Interpretation note box at bottom
    note_body = (
        "Some payment-status features show positive SHAP/LIME values, which increase default risk. "
        "Negative values generally indicate behaviours that reduce risk (for example, on-time or "
        "higher-than-minimum payments). The report should be read together with human judgement "
        "and current lending policies."
    )

    c.setFillColor(colors.HexColor("#fff8e1"))
    c.setStrokeColor(colors.lightgrey)
    c.rect(40, 40, w - 80, 60, stroke=1, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, 92, "Model Interpretation Note")
    c.setFont("Helvetica", 7)

    wrapped = wrap(note_body, 105)
    yy = 82
    for line in wrapped:
        c.drawString(48, yy, line)
        yy -= 9

    c.showPage()
    c.save()
    return buf.getvalue()


@router.get("/reports")
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return recent applications as 'reportable' items."""
    _require_analyst(current_user)
    rows = (
        db.query(LoanApplication)
        .order_by(LoanApplication.submitted_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id,
            "amount": r.amount,
            "submitted_at": (getattr(r, "submitted_at", None) or datetime.utcnow()).isoformat(),
            "applicant": {"full_name": r.full_name, "email": r.email},
        }
        for r in rows
    ]


@router.get("/report/{app_id}")
def download_report(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Produce a PDF on demand for the application (auth required)."""
    _require_analyst(current_user)
    app: Optional[LoanApplication] = db.get(LoanApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # history + limit, still for context
    hist = _history_summary(db, app.user_id)
    credit_limit = _compute_credit_limit(hist)

    # Use SAME mapping as analyze_application
    features = _map_application_to_features(app, hist, credit_limit)

    prob: Optional[float] = None
    if httpx is not None:
        try:
            r = httpx.post(
                "http://127.0.0.1:8000/ml/predict",
                #json={"features": features},
                json=features,
                timeout=6.0,
            )
            if r.status_code == 200:
                d = r.json()
                val = d.get("prob_default") or d.get("probability") or d.get("score")
                if val is not None:
                    prob = float(val)
        except Exception:
            pass
    if prob is None:
        prob = _heuristic_score(app)["prob_default"]

    # Try to fetch explainers for top drivers
    shap_pairs: List[Dict[str, Any]] = []
    lime_pairs: List[Dict[str, Any]] = []
    if httpx is not None:
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
            pass
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
            pass

    pdf = _pdf_bytes(app, prob, shap_pairs, lime_pairs)
    headers = {"Content-Disposition": f'attachment; filename="CreditAI_Report_{app.id}.pdf"'}
    return Response(content=pdf, media_type="application/pdf", headers=headers)
