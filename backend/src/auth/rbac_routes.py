# backend/src/auth/rbac_routes.py
from fastapi import APIRouter, Depends
from .dependencies import get_current_user, require_roles
from .models import User

router = APIRouter(prefix="/rbac", tags=["RBAC"])

@router.get("/me")
def read_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "role": user.role, "active": user.is_active}

@router.get("/user-only", dependencies=[Depends(require_roles("user", "analyst", "admin"))])
def user_only():
    return {"ok": True, "scope": "user-or-above"}

@router.get("/analyst-or-admin", dependencies=[Depends(require_roles("analyst", "admin"))])
def analyst_or_admin():
    return {"ok": True, "scope": "analyst-or-admin"}

@router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
def admin_only():
    return {"ok": True, "scope": "admin-only"}
