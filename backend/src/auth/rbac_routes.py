# backend/src/auth/rbac_routes.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .models import User, RoleEnum
from .dependencies import get_db, require_roles

router = APIRouter(prefix="/admin", tags=["admin"])

# ---- Schemas
class AssignRoleIn(BaseModel):
    email: EmailStr
    role: RoleEnum  # Enum: CUSTOMER / ANALYST / REGULATOR / ADMIN

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum
    is_active: bool

    class Config:
        orm_mode = True  # Pydantic v1 (FastAPI default)

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    return db.query(User).order_by(User.id.asc()).all()

@router.post("/assign-role")
def assign_role(
    payload: AssignRoleIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Optional: Prevent Admin from demoting themselves
    if user.id == admin.id and payload.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=400, detail="Admin cannot demote self")

    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"msg": "role updated", "email": user.email, "role": user.role.value}
