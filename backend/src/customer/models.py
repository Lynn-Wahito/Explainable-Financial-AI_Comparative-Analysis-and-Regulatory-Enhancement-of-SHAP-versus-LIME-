# src/customer/models.py
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

from ..db import Base  # your project's Base from src/db.py

class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)

    amount = Column(Float, nullable=False)
    purpose = Column(String(100), nullable=False)
    term_months = Column(Integer, nullable=False)

    income = Column(Float, nullable=False)
    employment_status = Column(String(50), nullable=False)
    housing_payment = Column(Float, nullable=False)
    other_debt = Column(Float, nullable=False)

    status = Column(String(30), default="Pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="loan_applications")
