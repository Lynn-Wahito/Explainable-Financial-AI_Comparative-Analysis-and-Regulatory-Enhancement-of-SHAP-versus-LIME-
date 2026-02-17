# backend/src/customer/models.py
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..db import Base

class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)

    # applicant identity snapshot (copied from user at submit time)
    full_name = Column(String(200), nullable=True)
    email = Column(String(200), nullable=True)
    national_id = Column(String(64), nullable=True)
    phone = Column(String(64), nullable=True)

    # loan fields
    amount = Column(Float, nullable=True)
    purpose = Column(String(120), nullable=True)
    term_months = Column(Integer, nullable=True)

    # profile fields aligned to UCI features (simple, realistic choices)
    education_level = Column(String(64), nullable=True)      # High school / University / Postgraduate / TVET / Other
    marital_status = Column(String(64), nullable=True)        # Single / Married / Other
    employment_status = Column(String(64), nullable=True)     # Full-time / Part-time / Self-employed / Unemployed

    # IMPORTANT: map Python attr 'annual_income' to DB column 'income' (NOT NULL)
    annual_income = Column("income", Float, nullable=False)

    housing_payment = Column(Float, nullable=True)
    other_debt = Column(Float, nullable=True)

    # workflow
    status = Column(String(64), nullable=True, index=True, default="pending")

    # timestamps
    # created_at is required by your DB (NOT NULL) -> give it a Python default
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    analyst_report_id = Column(String(64), nullable=True)

    user = relationship("User", backref="loan_applications")
