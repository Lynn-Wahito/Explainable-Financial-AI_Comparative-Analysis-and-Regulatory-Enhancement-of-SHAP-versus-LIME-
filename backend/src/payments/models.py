# backend/src/payments/models.py
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..db import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    loan_application_id = Column(Integer, ForeignKey("loan_applications.id"), nullable=True, index=True)

    period = Column(String(7), nullable=False, index=True)   # e.g. "2025-06"
    due_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, nullable=False, default=0.0)
    paid_at = Column(DateTime, nullable=True)                # None if missed
    status = Column(String(16), nullable=False, index=True)  # "on_time" | "late" | "missed"

    created_at = Column(DateTime, default=datetime.utcnow)

    loan = relationship("LoanApplication", backref="payments", lazy="joined")
