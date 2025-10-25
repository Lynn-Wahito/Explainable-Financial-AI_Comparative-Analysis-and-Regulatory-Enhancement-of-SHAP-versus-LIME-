# backend/src/ml/routes.py
"""
Lightweight ML utility routes that do NOT overlap with predict_api.py.
Keep only health / simple utilities here to avoid path collisions.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/ml", tags=["ml"])

@router.get("/health", summary="Health check for ML service")
def health():
    """
    Basic health endpoint to confirm the ML router is mounted.
    Returns {"status": "ok"} if the API is reachable.
    """
    return {"status": "ok"}
