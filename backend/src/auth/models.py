# backend/src/auth/models.py
from enum import Enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum as SAEnum,
    ForeignKey, Index
)
from sqlalchemy.orm import relationship

from ..db import Base

class RoleEnum(str, Enum):
    CUSTOMER = "customer"
    ANALYST = "analyst"
    REGULATOR = "regulator"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Role can be NULL until admin approves
    role = Column(SAEnum(RoleEnum), nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)

    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    totp_secret = Column(String(64), nullable=True) 

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # OTP (legacy/optional – for simple flows)
    otp_code = Column(String, nullable=True)
    otp_expires = Column(DateTime, nullable=True)

    # Password reset
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

    # Email verification
    verification_token = Column(String, nullable=True)
    verification_expires = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role} active={self.is_active}>"

class TwoFactorCode(Base):
    __tablename__ = "two_factor_codes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    purpose = Column(String(32), default="login")  # 'login' for now
    ticket = Column(String(64), index=True, nullable=False)  # random session id
    code = Column(String(6), nullable=False)                 # 6-digit OTP
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# composite index for fast lookups
Index(
    "ix_2fa_user_purpose_active",
    TwoFactorCode.user_id,
    TwoFactorCode.purpose,
    TwoFactorCode.used,
)
