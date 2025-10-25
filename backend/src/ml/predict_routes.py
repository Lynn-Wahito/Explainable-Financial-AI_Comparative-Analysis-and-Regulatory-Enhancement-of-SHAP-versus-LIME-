# backend/src/ml/predict_routes.py
from fastapi import APIRouter, HTTPException
import os, json
import pandas as pd

from .schemas import PredictIn
from .model_utils import load_artifacts, ensure_column_order, ARTIFACTS_DIR, MODEL_PATH, PREPROCESSOR_PATH, METRICS_PATH

router = APIRouter(prefix="/ml", tags=["ml"])

model, preprocessor, model_name = load_artifacts()

@router.get("/health")
def ml_health():
    return {
        "model_name": model_name,
        "model_path_exists": os.path.exists(MODEL_PATH),
        "preprocessor_path_exists": os.path.exists(PREPROCESSOR_PATH),
        "metrics": json.load(open(METRICS_PATH)) if os.path.exists(METRICS_PATH) else None
    }

@router.post("/reload")
def ml_reload():
    global model, preprocessor, model_name
    model, preprocessor, model_name = load_artifacts()
    return {"msg": "artifacts reloaded", "model_name": model_name}

@router.post("/predict")
def predict(payload: PredictIn):
    try:
        df = pd.DataFrame([payload.model_dump()])
        df = ensure_column_order(df)

        X = preprocessor.transform(df) if preprocessor is not None else df.values

        if hasattr(model, "predict_proba"):
            prob = float(model.predict_proba(X)[:, 1][0])
        else:
            raw = model.predict(X)
            prob = float(raw[0] if hasattr(raw, "__getitem__") else raw)

        predicted = int(1 if prob >= 0.5 else 0)
        return {
            "model": model_name,
            "predicted_label": predicted,
            "probability": round(prob, 4)
        }
    except Exception as e:
        print("[ERROR] /ml/predict failed:", e)
        raise HTTPException(status_code=500, detail="Prediction failed")
