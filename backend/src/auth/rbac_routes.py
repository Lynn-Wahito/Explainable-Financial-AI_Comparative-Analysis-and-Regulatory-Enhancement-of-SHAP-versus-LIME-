# backend/src/auth/rbac_routes.py
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .models import User, RoleEnum
from .dependencies import get_db, require_roles

router = APIRouter(prefix="/admin", tags=["admin"])

# ---- Schemas
class AssignRoleIn(BaseModel):
    # we’ll accept either user_id or email (email is convenient in UI)
    user_id: Optional[int] = None
    email: Optional[EmailStr] = None
    role: RoleEnum

class UserOut(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: EmailStr
    role: Optional[RoleEnum] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True  # FastAPI default (Pydantic v1). If v2: model_config = ConfigDict(from_attributes=True)

class AdminMetricsOut(BaseModel):
        total_users: int
        active_users: int
        pending_users: int
        last_registered_email: Optional[EmailStr] = None
        last_registered_at: Optional[datetime] = None
        started_at: Optional[datetime] = None
        server_time: datetime

@router.get("/users", response_model=List[UserOut])
def list_users(
    status: Optional[str] = Query(default=None, description="pending|active|all"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    """
    Returns users. Optional filter:
      - status=pending  -> role is NULL OR not active
      - status=active   -> role not null AND active
      - status=all (or omitted) -> all users
    """
    q = db.query(User)
    if status == "pending":
        q = q.filter((User.role == None) | (User.is_active == False))  # noqa: E711
    elif status == "active":
        q = q.filter((User.role != None) & (User.is_active == True))  # noqa: E711
    return q.order_by(User.created_at.desc()).all()

@router.post("/assign-role", response_model=UserOut)
def assign_role(
    payload: AssignRoleIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    if not payload.user_id and not payload.email:
        raise HTTPException(status_code=400, detail="Provide user_id or email")

    user = None
    if payload.user_id:
        user = db.query(User).get(payload.user_id)
    elif payload.email:
        user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Optional safety: prevent self-demotion
    if user.id == admin.id and payload.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=400, detail="Admin cannot demote self")

    user.role = payload.role
    user.is_active = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/deactivate")
def deactivate_user(
    email: EmailStr,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.add(user)
    db.commit()
    return {"msg": "deactivated", "email": email}

@router.get("/metrics", response_model=AdminMetricsOut)
def admin_metrics(
        request: Request,
        db: Session = Depends(get_db),
        _: User = Depends(require_roles(RoleEnum.ADMIN)),
    ):
        total = db.query(User).count()
        active = db.query(User).filter(User.is_active == True).count()  # noqa: E712
        pending = db.query(User).filter((User.role == None) | (User.is_active == False)).count()  # noqa: E711

        last = db.query(User).order_by(User.created_at.desc()).first()

        started_at = getattr(request.app.state, "started_at", None)
        return {
            "total_users": total,
            "active_users": active,
            "pending_users": pending,
            "last_registered_email": getattr(last, "email", None),
            "last_registered_at": getattr(last, "created_at", None),
            "started_at": started_at,
            "server_time": datetime.utcnow(),
        }