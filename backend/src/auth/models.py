# backend/src/auth/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from ..db import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
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
