# backend/src/auth/routes.py
import time
import random
from typing import Literal
from datetime import datetime, timedelta
from ..auth.utils import generate_verification_token, verify_token
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .models import User, RoleEnum
from .utils import (
    hash_password,
    verify_password,
    create_access_token,
    generate_reset_token,
    generate_verification_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- Schemas ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RequestResetIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

class RequestVerifyIn(BaseModel):
    email: EmailStr

class VerifyEmailIn(BaseModel):
    token: str

class AssignRoleIn(BaseModel):
    user_id: int
    role: RoleEnum 

# ---------- Endpoints ----------
@router.post("/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=RoleEnum.CUSTOMER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"msg": "registered", "email": user.email, "role": user.role}

@router.post("/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Direct JWT 
    token = create_access_token(subject=str(user.id), data={"role": user.role, "email": user.email})
    return {"access_token": token, "token_type": "bearer", "role": user.role}

@router.post("/request-reset")
def request_reset(payload: RequestResetIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"msg": "If that email exists, a reset link was sent."}
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires = time.time() + (20 * 60)  # 20 minutes
    db.add(user)
    db.commit()
    # Simulate email: print link
    print(f"[SIMULATED EMAIL] Reset link: http://localhost:5173/reset-password?token={token}")
    return {"msg": "If that email exists, a reset link was sent."}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == payload.token).first()
    if not user or time.time() > (user.reset_token_expires or 0):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.add(user)
    db.commit()
    return {"msg": "Password reset successful"}

@router.post("/request-verification")
def request_verification(payload: RequestVerifyIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"msg": "If that email exists, a verification link was sent."}
    token = generate_verification_token()
    user.verification_token = token
    user.verification_expires = datetime.utcnow() + timedelta(minutes=30)
    db.add(user)
    db.commit()
    print(f"[SIMULATED EMAIL] Verify link: http://localhost:5173/verify-email?token={token}")
    return {"msg": "If that email exists, a verification link was sent."}

@router.post("/verify-email")
def verify_email(payload: VerifyEmailIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == payload.token).first()
    if not user or datetime.utcnow() > (user.verification_expires or datetime.utcnow()):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user.is_verified = True
    user.verification_token = None
    user.verification_expires = None
    db.add(user)
    db.commit()
    return {"msg": "Email verified successfully", "email": user.email, "is_verified": user.is_verified}

@router.post("/admin/assign-role")
def assign_role(payload: AssignRoleIn, db: Session = Depends(get_db)):
    # TODO: In next RBAC issue, protect this route with require_roles([RoleEnum.ADMIN])
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"msg": "role-assigned", "user_id": user.id, "role": user.role}