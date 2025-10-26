# backend/src/ml/xai_routes.py  (only the handlers + helper were changed below)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
from pathlib import Path
import numpy as np
import joblib

import shap
from lime.lime_tabular import LimeTabularExplainer

router = APIRouter(prefix="", tags=["xai"])

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "models" / "xgb_credit.pkl"

_MODEL = None
_FEATURE_NAMES: Optional[List[str]] = None

class ExplainRequest(BaseModel):
    features: Dict[str, float] = Field(..., description="Feature dict (name -> value)")
    method: str = Field(..., description="'shap' or 'lime'")

def _load_estimator(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"MODEL not found: {path}")
    obj = joblib.load(path)
    model = obj
    f_names = None
    if isinstance(obj, dict):
        if "model" in obj:
            model = obj["model"]
        if "feature_names" in obj and isinstance(obj["feature_names"], list):
            f_names = obj["feature_names"]
    if f_names is None:
        if hasattr(model, "feature_names_in_"):
            f_names = list(model.feature_names_in_)
        else:
            try:
                booster = getattr(model, "get_booster", lambda: None)()
                if booster is not None and getattr(booster, "feature_names", None):
                    f_names = list(booster.feature_names)
            except Exception:
                pass
    return model, f_names

def _ensure_model_loaded():
    global _MODEL, _FEATURE_NAMES
    if _MODEL is None:
        _MODEL, _FEATURE_NAMES = _load_estimator(MODEL_PATH)
        print(f"[XAI] Loaded estimator -> {MODEL_PATH} ({type(_MODEL)})")
        if _FEATURE_NAMES:
            print(f"[XAI] Feature order ({len(_FEATURE_NAMES)}): {_FEATURE_NAMES[:6]} ...")

def _vectorize(features: Dict[str, float]):
    global _FEATURE_NAMES
    order = _FEATURE_NAMES if _FEATURE_NAMES else sorted(features.keys())
    try:
        x = np.array([float(features[k]) for k in order], dtype=float).reshape(1, -1)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad feature values: {e}")
    return x, order

def _make_background(x: np.ndarray, n: int = 200) -> np.ndarray:
    """
    Create a simple noisy background around x (per-feature gaussian noise) so
    LIME/SHAP can perturb. Keeps it small & fast but non-degenerate.
    """
    x = x.reshape(1, -1)
    # Scale noise relative to magnitude; ensure at least small variance
    scale = np.maximum(1.0, 0.05 * np.maximum(1.0, np.abs(x)))
    rng = np.random.default_rng(42)
    bg = x + rng.normal(loc=0.0, scale=scale, size=(n, x.shape[1]))
    return bg.astype(float)

@router.post("/explain/shap")
def explain_shap(req: ExplainRequest):
    if req.method.lower() != "shap":
        raise HTTPException(status_code=400, detail="Use method='shap' at this endpoint")

    _ensure_model_loaded()
    x, order = _vectorize(req.features)

    # ---- Try TreeExplainer first (fast for tree models)
    try:
        explainer = shap.TreeExplainer(_MODEL, feature_perturbation="interventional", model_output="probability")
        shap_vals = explainer.shap_values(x)
        if isinstance(shap_vals, list):  # sometimes list per class
            shap_vals = shap_vals[1] if len(shap_vals) > 1 else shap_vals[0]
    except Exception as tree_err:
        # ---- Robust fallback using masker + generic Explainer
        try:
            background = _make_background(x, n=200)
            masker = shap.maskers.Independent(background)
            explainer = shap.Explainer(_MODEL, masker)
            explanation = explainer(x)
            vals = explanation.values
            if vals.ndim == 3:
                vals = vals[0, :, 1] if vals.shape[2] > 1 else vals[0, :, 0]
            shap_vals = vals
        except Exception as gen_err:
            raise HTTPException(
                status_code=500,
                detail=f"SHAP failed: TreeExplainer: {repr(tree_err)} | Explainer: {repr(gen_err)}"
            )

    shap_vals = np.array(shap_vals).reshape(-1)
    top_idx = np.argsort(np.abs(shap_vals))[::-1][:5]
    top = [{"feature": order[i], "impact": float(shap_vals[i])} for i in top_idx]
    return {
        "model": type(_MODEL).__name__,
        "method": "SHAP",
        "top_features": top,
        "order_used": order
    }

@router.post("/explain/lime")
def explain_lime(req: ExplainRequest):
    if req.method.lower() != "lime":
        raise HTTPException(status_code=400, detail="Use method='lime' at this endpoint")

    _ensure_model_loaded()
    x, order = _vectorize(req.features)

    # Use noisy background so LIME has variance (avoids all-zeros)
    background = _make_background(x, n=300)
    class_names = ["class0", "class1"]

    explainer = LimeTabularExplainer(
        training_data=background,
        feature_names=order,
        class_names=class_names,
        mode="classification"
    )

    def _proba(Z):
        if hasattr(_MODEL, "predict_proba"):
            return _MODEL.predict_proba(Z)
        if hasattr(_MODEL, "decision_function"):
            s = _MODEL.decision_function(Z)
            p1 = 1 / (1 + np.exp(-s))
            return np.c_[1 - p1, p1]
        p = _MODEL.predict(Z)
        return np.c_[1 - p, p]

    try:
        exp = explainer.explain_instance(x[0], _proba, num_features=min(5, x.shape[1]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LIME failed: {repr(e)}")

    top = [{"feature": f, "importance": float(w)} for f, w in exp.as_list()[:5]]

    return {
        "model": type(_MODEL).__name__,
        "method": "LIME",
        "top_features": top,
        "order_used": order
    }
