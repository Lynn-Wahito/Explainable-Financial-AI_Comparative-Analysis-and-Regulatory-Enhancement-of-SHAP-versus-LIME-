# src/customer/routes.py
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..auth.models import User
from ..auth.utils import get_current_user  # MUST exist in src/auth/utils.py

# Try to import your LoanApplication ORM if you’ve created it.
# If it doesn't exist yet, we’ll handle that gracefully below.
try:
    from .models import LoanApplication  # optional, if you created it
except Exception:
    LoanApplication = None  # sentinel, so routes still load


router = APIRouter(prefix="/customer", tags=["customer"])


# -------------------------------
# DB dependency
# -------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------------
# Schemas
# -------------------------------
class LoanApplicationIn(BaseModel):
    amount: float = Field(..., gt=0)
    purpose: str
    term_months: int = Field(..., gt=0)
    income: float = Field(..., ge=0)
    employment_status: str
    housing_payment: float = Field(..., ge=0)
    other_debt: float = Field(..., ge=0)


class ApplicationOut(BaseModel):
    id: Optional[int] = None
    amount: Optional[float] = None
    purpose: Optional[str] = None
    status: Optional[str] = "Pending"
    submitted: Optional[str] = None

    # pydantic v2: allow ORM mapping
    model_config = {"from_attributes": True}


class DashboardOut(BaseModel):
    profile: dict
    credit: dict
    applications: List[ApplicationOut] = []


# -------------------------------
# Helpers
# -------------------------------
def _map_app_for_response(a) -> ApplicationOut:
    """
    Normalize a LoanApplication ORM row to ApplicationOut.
    """
    created = getattr(a, "created_at", None) or datetime.utcnow()
    return ApplicationOut(
        id=getattr(a, "id", None),
        amount=getattr(a, "amount", None),
        purpose=(getattr(a, "purpose", None) or getattr(a, "loan_purpose", None)),
        status=(getattr(a, "status", None) or getattr(a, "decision", "Pending")),
        submitted=created.strftime("%b %d, %Y"),
    )


# -------------------------------
# Routes
# -------------------------------

@router.get("/dashboard", response_model=DashboardOut)
def customer_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return minimal live data for the customer dashboard.
    If LoanApplication model exists, we load the user's applications.
    Otherwise we return an empty list (front-end still renders).
    """
    # Profile block
    profile = {
        "id": user.id,
        "email": user.email,
        "name": user.full_name or user.email.split("@")[0].title(),
        "role": getattr(user, "role", None).value if getattr(user, "role", None) else None,
    }

    # Credit summary – replace with your real aggregates
    credit = {
        "pending_count": 0,
        "approved_count": 0,
        "total_limit": 75000,
    }

    # Applications
    applications: List[ApplicationOut] = []
    if LoanApplication is not None:
        q = db.query(LoanApplication).filter(LoanApplication.user_id == user.id)
        # Order by created_at if present on the model
        if hasattr(LoanApplication, "created_at"):
            q = q.order_by(LoanApplication.created_at.desc())
        rows = q.limit(20).all()

        applications = [_map_app_for_response(r) for r in rows]

        # very simple summary (adjust to your real fields)
        credit["pending_count"] = sum(
            1 for a in applications if (a.status or "").lower() in {"pending", "under review"}
        )
        credit["approved_count"] = sum(
            1 for a in applications if (a.status or "").lower() in {"approved"}
        )
        # total_limit could be computed from approved loans; left static here

    return {
        "profile": profile,
        "credit": credit,
        "applications": applications,
    }


@router.get("/applications", response_model=List[ApplicationOut])
def list_my_applications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return this user's applications for the Customer UI (used by /customer/applications in the FE).
    """
    if LoanApplication is None:
        # Keeping this consistent with your apply route: surface a helpful message if model missing
        raise HTTPException(
            status_code=501,
            detail=(
                "LoanApplication model is not defined. "
                "Create src/customer/models.py with a SQLAlchemy LoanApplication model "
                "(fields: id, user_id, amount, purpose, term_months, income, employment_status, "
                "housing_payment, other_debt, status, created_at) and import it in routes."
            ),
        )

    q = db.query(LoanApplication).filter(LoanApplication.user_id == user.id)
    if hasattr(LoanApplication, "created_at"):
        q = q.order_by(LoanApplication.created_at.desc())
    rows = q.all()

    return [_map_app_for_response(r) for r in rows]


@router.post("/apply")
def apply_for_loan(
    payload: LoanApplicationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Create a new loan application for the logged-in customer.
    Requires your LoanApplication ORM model. If it's missing,
    we return a helpful 501 explaining what to add.
    """
    if LoanApplication is None:
        raise HTTPException(
            status_code=501,
            detail=(
                "LoanApplication model is not defined. "
                "Create src/customer/models.py with a SQLAlchemy LoanApplication model "
                "(fields: id, user_id, amount, purpose, term_months, income, employment_status, "
                "housing_payment, other_debt, status, created_at) and import it here."
            ),
        )

    # Create and store the new application
    app = LoanApplication(
        user_id=user.id,
        amount=payload.amount,
        purpose=payload.purpose,
        term_months=payload.term_months,
        income=payload.income,
        employment_status=payload.employment_status,
        housing_payment=payload.housing_payment,
        other_debt=payload.other_debt,
        status="Pending",
        created_at=datetime.utcnow(),
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    return {
        "message": "Application submitted successfully",
        "application": {
            "id": app.id,
            "amount": app.amount,
            "purpose": app.purpose,
            "status": app.status,
            "submitted": app.created_at.strftime("%b %d, %Y"),
        },
    }
