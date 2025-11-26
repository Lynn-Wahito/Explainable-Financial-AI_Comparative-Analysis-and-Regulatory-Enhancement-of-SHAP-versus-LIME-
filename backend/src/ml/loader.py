# backend/src/ml/loader.py
import joblib, numpy as np, json
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
pipe = joblib.load(MODELS_DIR / "xgb_credit.pkl")
preproc = joblib.load(MODELS_DIR / "preprocessor.pkl")
shap_bg = np.load(MODELS_DIR / "shap_background.npy")
lime_explainer = joblib.load(MODELS_DIR / "lime_config.pkl")
feature_names = json.load(open(MODELS_DIR / "features.json"))["feature_names"]
