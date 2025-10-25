# backend/src/auth/models.py
from enum import Enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from ..db import Base

class RoleEnum(str, Enum):
    CUSTOMER = "customer"
    ANALYST = "analyst"
    REGULATOR = "regulator"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Use RoleEnum for roles
    role = Column(SAEnum(RoleEnum, name="role_enum"), nullable=False, default=RoleEnum.CUSTOMER)

    is_active = Column(Boolean, default=True)

    # OTP (for login 2-step)
    otp_code = Column(String, nullable=True)
    otp_expires = Column(DateTime, nullable=True)

    # Password reset
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

    # Email verification
    verification_token = Column(String, nullable=True)
    verification_expires = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)
