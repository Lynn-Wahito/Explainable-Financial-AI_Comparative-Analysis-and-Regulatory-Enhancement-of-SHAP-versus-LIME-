# backend/src/auth/routes.py
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .models import User
from .utils import (
    hash_password,
    verify_password,
    create_access_token,
    generate_reset_token,
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
    role: str = "user"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RequestResetIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

# ---------- Endpoints ----------
@router.post("/register")
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
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
    # Direct JWT (OTP will replace this in Issue #4)
    token = create_access_token(subject=str(user.id), data={"role": user.role, "email": user.email})
    return {"access_token": token, "token_type": "bearer"}

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
