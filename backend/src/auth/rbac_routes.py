# backend/src/auth/rbac_routes.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .models import User
from .dependencies import get_current_user, require_roles

router = APIRouter(prefix="/admin", tags=["admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class AssignRoleIn(BaseModel):
    target_email: EmailStr
    new_role: str  # "customer" | "analyst" | "regulator" | "admin"

ALLOWED_ROLES = {"customer", "analyst", "regulator", "admin"}

@router.get("/users")
def list_users(_=Depends(require_roles(["admin"])), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_verified": u.is_verified
        }
        for u in users
    ]

@router.post("/assign-role")
def assign_role(payload: AssignRoleIn, admin=Depends(require_roles(["admin"])), db: Session = Depends(get_db)):
    if payload.new_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = db.query(User).filter(User.email == payload.target_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = payload.new_role
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"msg": "role_updated", "email": user.email, "role": user.role}
