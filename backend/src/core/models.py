# backend/src/core/models.py
import os
from sqlalchemy import (
    Column, Integer, String, Float, Numeric, ForeignKey, TIMESTAMP, Text
)
from sqlalchemy.orm import relationship
from ..db import Base, engine

class Customer(Base):
    __tablename__ = "customer"
    customer_id = Column(Integer, primary_key=True, index=True)
    sex = Column(String, nullable=False)          # 1=male, 2=female
    education = Column(String, nullable=True)     # 1=grad, 2=univ, 3=hs, 4=other
    marriage = Column(String, nullable=True)      # 1=married, 2=single, 3=other
    age = Column(Integer, nullable=False)

    credit_accounts = relationship("CreditAccount", back_populates="customer")


class CreditAccount(Base):
    __tablename__ = "credit_account"
    account_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customer.customer_id"))
    limit_bal = Column(Numeric, nullable=False)

    customer = relationship("Customer", back_populates="credit_accounts")
    payment_statuses = relationship("PaymentStatus", back_populates="account")
    bill_amounts = relationship("BillAmount", back_populates="account")
    payment_amounts = relationship("PaymentAmount", back_populates="account")
    model_results = relationship("ModelResults", back_populates="account")


class PaymentStatus(Base):
    __tablename__ = "payment_status"
    pay_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("credit_account.account_id"))
    month = Column(Integer, nullable=False)       # 1..6
    status = Column(Integer, nullable=False)      # -1=pay duly, 0=revolving, 1..9=delay months

    account = relationship("CreditAccount", back_populates="payment_statuses")


class BillAmount(Base):
    __tablename__ = "bill_amount"
    bill_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("credit_account.account_id"))
    month = Column(Integer, nullable=False)
    amount = Column(Numeric, nullable=False)

    account = relationship("CreditAccount", back_populates="bill_amounts")


class PaymentAmount(Base):
    __tablename__ = "payment_amount"
    payamt_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("credit_account.account_id"))
    month = Column(Integer, nullable=False)
    amount = Column(Numeric, nullable=False)

    account = relationship("CreditAccount", back_populates="payment_amounts")


class ModelResults(Base):
    __tablename__ = "model_results"
    result_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("credit_account.account_id"))
    model_name = Column(String, nullable=False)
    predicted_label = Column(String, nullable=False)
    probability = Column(Float, nullable=True)
    run_at = Column(TIMESTAMP, nullable=False)

    account = relationship("CreditAccount", back_populates="model_results")
    explanations = relationship("ExplanationResults", back_populates="model_result")


class ExplanationResults(Base):
    __tablename__ = "explanation_results"
    explanation_id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("model_results.result_id"))
    method = Column(String, nullable=False)  # SHAP / LIME
    explanation_json = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)

    model_result = relationship("ModelResults", back_populates="explanations")


# Create tables if run directly
if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("✅ Core DB schema created at", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "IS_PROJECT_II_backend.db")))
