# backend/src/ml/predict_api.py
import os
import joblib
import pickle
import numpy as np
from typing import Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .schemas import PredictIn, PredictOut

router = APIRouter(prefix="/ml", tags=["ml"])

# ---------- Typed response for /ml/info ----------
class InfoOut(BaseModel):
    loaded: bool
    model_path: Optional[str] = None
    model_type: Optional[str] = None
    feature_schema: List[str]
    predict_proba: bool
    debug: Optional[str] = None  # extra diagnostic info

MODEL: Optional[Any] = None
MODEL_PATH_LOADED: Optional[str] = None
LAST_ERROR: Optional[str] = None

# Prefer a proper artifact FIRST
MODEL_CANDIDATES = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "artifacts", "xgb_model.joblib")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "xgb_credit.pkl")),
]

FEATURE_ORDER = [
    "LIMIT_BAL","SEX","EDUCATION","MARRIAGE","AGE",
    "PAY_0","PAY_2","PAY_3","PAY_4","PAY_5","PAY_6",
    "BILL_AMT1","BILL_AMT2","BILL_AMT3","BILL_AMT4","BILL_AMT5","BILL_AMT6",
    "PAY_AMT1","PAY_AMT2","PAY_AMT3","PAY_AMT4","PAY_AMT5","PAY_AMT6",
]

def _is_valid_model(m: Any) -> bool:
    return hasattr(m, "predict") or hasattr(m, "predict_proba")

def _unwrap_if_dict(obj: Any) -> Any:
    """
    If the loaded object is a dict, try common keys to extract the actual estimator.
    """
    if isinstance(obj, dict):
        for k in ("model", "estimator", "clf"):
            if k in obj and _is_valid_model(obj[k]):
                print(f"[ML] Found estimator in dict under key '{k}' -> {type(obj[k])}")
                return obj[k]
        # If it’s a dict but no estimator inside, return as-is (caller will reject)
    return obj

def _load_model() -> bool:
    global MODEL, MODEL_PATH_LOADED, LAST_ERROR
    MODEL, MODEL_PATH_LOADED, LAST_ERROR = None, None, None

    for path in MODEL_CANDIDATES:
        if not os.path.exists(path):
            continue
        try:
            if path.endswith(".joblib"):
                obj = joblib.load(path)
            else:
                with open(path, "rb") as f:
                    obj = pickle.load(f)

            obj = _unwrap_if_dict(obj)

            if _is_valid_model(obj):
                MODEL, MODEL_PATH_LOADED = obj, path
                print(f"[ML] Loaded model -> {path} ({type(MODEL)})")
                return True
            else:
                msg = f"object has no predict/predict_proba (type={type(obj)})"
                print(f"[ML] Skipping {path}: {msg}")
                LAST_ERROR = f"{path}: {msg}"

        except Exception as e:
            msg = f"Failed to load {path}: {type(e).__name__}: {e}"
            print(f"[ML] {msg}")
            LAST_ERROR = msg

    print("[ML] No valid model found.")
    return False

# Load on import
_load_model()

@router.get("/info", response_model=InfoOut, summary="ML Info")
def ml_info() -> InfoOut:
    return InfoOut(
        loaded=MODEL is not None,
        model_path=MODEL_PATH_LOADED,
        model_type=str(type(MODEL)) if MODEL is not None else None,
        feature_schema=FEATURE_ORDER,
        predict_proba=(hasattr(MODEL, "predict_proba") if MODEL is not None else False),
        debug=LAST_ERROR,
    )

@router.post("/reload", summary="Reload Model")
def ml_reload() -> dict:
    ok = _load_model()
    return {"reloaded": ok, "model_path": MODEL_PATH_LOADED, "debug": LAST_ERROR}

@router.get("/health", summary="Health")
def ml_health() -> dict:
    return {"ok": True, "loaded": MODEL is not None, "path": MODEL_PATH_LOADED}

@router.post("/predict", response_model=PredictOut, summary="Predict Credit Risk")
def predict(payload: PredictIn):
    if MODEL is None:
        raise HTTPException(status_code=500, detail="Model not loaded. Hit /ml/reload or train the model.")
    try:
        feats = [getattr(payload, k) for k in FEATURE_ORDER]
        X = np.array([feats], dtype=float)

        if hasattr(MODEL, "predict_proba"):
            proba = float(MODEL.predict_proba(X)[:, 1].item())
        else:
            score = float(MODEL.predict(X)[0])
            proba = max(0.0, min(score, 1.0))

        label = 1 if proba >= 0.5 else 0
        return {"model": "XGBoost", "predicted_label": label, "probability": round(proba, 4)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {type(e).__name__}: {e}")
