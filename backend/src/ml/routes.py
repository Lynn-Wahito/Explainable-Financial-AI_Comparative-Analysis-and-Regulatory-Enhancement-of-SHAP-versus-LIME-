# backend/src/ml/routes.py
from fastapi import APIRouter

router = APIRouter(prefix="/ml", tags=["ml-misc"])

@router.get("/health")
def health():
    return {"ok": True}
