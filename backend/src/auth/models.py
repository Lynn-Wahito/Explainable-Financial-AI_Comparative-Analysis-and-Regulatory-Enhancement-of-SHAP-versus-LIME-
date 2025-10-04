from sqlalchemy import Column, Integer, String, Boolean, Float
from ..db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")
    is_active = Column(Boolean, default=True)

    # OTP + Reset fields for Issue #3
    otp_code = Column(String, nullable=True)
    otp_expires = Column(Float, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(Float, nullable=True)
