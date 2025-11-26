# backend/src/ml/train_xgb_xai.py
import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, List

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, roc_auc_score, f1_score, precision_score, recall_score,
    confusion_matrix, classification_report
)
from xgboost import XGBClassifier

# Optional: SHAP/LIME are best-effort (script still trains if missing)
try:
    import shap  # type: ignore
except Exception:
    shap = None

try:
    from lime.lime_tabular import LimeTabularExplainer  # type: ignore
except Exception:
    LimeTabularExplainer = None  # type: ignore

# -------------------------
# Config
# -------------------------
RANDOM_STATE = 42
TEST_SIZE = 0.2
VALID_SIZE = 0.1            # from train portion
N_JOBS = -1
MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

ARTIFACT_MODEL = MODELS_DIR / "xgb_credit.pkl"
ARTIFACT_PREPROC = MODELS_DIR / "preprocessor.pkl"
ARTIFACT_FEATURES = MODELS_DIR / "features.json"
ARTIFACT_METADATA = MODELS_DIR / "training_meta.json"
ARTIFACT_SHAP_BG = MODELS_DIR / "shap_background.npy"
ARTIFACT_LIME = MODELS_DIR / "lime_config.pkl"  # now a config dict, not the explainer object
ARTIFACT_VALID = MODELS_DIR / "validation_pack.pkl"

# -------------------------
# Load dataset (UCI Credit Card)
# -------------------------
def load_uci_credit(path_csv: str) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Loads UCI Credit CSV and robustly finds the binary target column.
    Accepts header variants (spaces/dots/underscores/case).
    You can also override via env var: UCI_TARGET_COLUMN.
    Cleans non-numeric label rows (e.g., accidental second header line).
    """
    # auto-detect delimiter, handle BOM
    df = pd.read_csv(path_csv, engine="python", sep=None, encoding="utf-8-sig")

    # Allow explicit override if user sets it
    override = os.getenv("UCI_TARGET_COLUMN")
    if override and override in df.columns:
        y_col = override
    else:
        # Normalizer for header names
        def norm(s: str) -> str:
            return (
                str(s).strip().lower()
                .replace(" ", "")
                .replace(".", "")
                .replace("_", "")
            )

        # Map original -> normalized
        colmap = {c: norm(c) for c in df.columns}

        # Known variants of the label
        candidates_norm = {
            "defaultpaymentnextmonth",
            "defaultnextmonth",
            "default",
            "y",
            "label",
            "class",
        }

        # Try to find a direct normalized match
        y_col = None
        for orig, n in colmap.items():
            if n in candidates_norm:
                y_col = orig
                break

        # Heuristic fallback: any binary column with a name that hints "default"/"next"
        if y_col is None:
            binaries = [c for c in df.columns if set(pd.Series(df[c]).dropna().unique()).issubset({0, 1})]
            hint_bins = [c for c in binaries if ("default" in c.lower()) or ("next" in c.lower())]
            if hint_bins:
                y_col = hint_bins[0]
            elif binaries:  # last-resort: some binary column
                y_col = binaries[-1]

    if y_col is None:
        raise ValueError(
            "Target column not found. Set UCI_TARGET_COLUMN to the exact header, "
            "or rename your label to 'default.payment.next.month'. "
            f"CSV columns: {list(df.columns)}"
        )

    print(f"[INFO] Using target column: {y_col}")

    # --- Clean/convert label to 0/1 integers ---
    y_raw = df[y_col]

    # Map common textual labels if present
    text_map = {
        "yes": 1, "true": 1, "y": 1, "default": 1,
        "no": 0, "false": 0, "n": 0, "nodefault": 0,
    }
    if y_raw.dtype == object:
        y_norm = y_raw.astype(str).str.strip().str.lower().map(text_map)
    else:
        y_norm = pd.Series([np.nan] * len(df))

    # Prefer numeric coercion; fallback uses mapped values
    y_num = pd.to_numeric(y_raw, errors="coerce")
    y_final = y_num.fillna(y_norm)

    # Drop rows where label is still NaN (e.g., stray header line inside data)
    bad_mask = y_final.isna()
    bad_count = int(bad_mask.sum())
    if bad_count > 0:
        print(f"[WARN] Dropping {bad_count} row(s) with non-numeric label in '{y_col}'.")
        df = df.loc[~bad_mask].copy()
        y_final = y_final.loc[~bad_mask]

    # Ensure integer 0/1
    y = y_final.astype(int)

    # Build X aligned to cleaned index and drop common ID columns if present
    X = df.drop(columns=[y_col])
    for drop_col in ["ID", "id", "Id"]:
        if drop_col in X.columns:
            X = X.drop(columns=[drop_col])

    return X, y

# -------------------------
# Build pipeline
# -------------------------
def build_pipeline(X: pd.DataFrame, y_for_weights: pd.Series) -> Tuple[Pipeline, List[str]]:
    numeric_features = X.columns.tolist()  
    numeric_transform = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])

    preproc = ColumnTransformer(
        transformers=[("num", numeric_transform, numeric_features)],
        remainder="drop"
    )

    # Handle imbalance: scale_pos_weight = (neg / pos)
    pos = int(np.sum(y_for_weights == 1))
    neg = int(np.sum(y_for_weights == 0))
    pos_weight = float(neg / max(1, pos))

    xgb = XGBClassifier(
        n_estimators=350,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.8,
        reg_lambda=1.0,
        random_state=RANDOM_STATE,
        eval_metric="logloss",
        n_jobs=N_JOBS,
        scale_pos_weight=pos_weight,

        objective="binary:logistic",
    )
    setattr(xgb, "_estimator_type", "classifier")

    calibrated = CalibratedClassifierCV(
        xgb,
        method="sigmoid",
        cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE),
    )

    pipe = Pipeline(steps=[
        ("preproc", preproc),
        ("clf", calibrated),
    ])

    return pipe, numeric_features

# -------------------------
# Train / Evaluate
# -------------------------
def evaluate(model: Pipeline, X_test, y_test, name="XGB-Calibrated"):
    proba = model.predict_proba(X_test)[:, 1]
    preds = (proba >= 0.5).astype(int)

    metrics = {
        "accuracy": float(accuracy_score(y_test, preds)),
        "roc_auc": float(roc_auc_score(y_test, proba)),
        "f1": float(f1_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds)),
        "recall": float(recall_score(y_test, preds)),
        "confusion_matrix": confusion_matrix(y_test, preds).tolist(),
        "report": classification_report(y_test, preds, output_dict=True),
    }
    print(f"\n== {name} Metrics ==")
    for k, v in metrics.items():
        if k not in ("confusion_matrix", "report"):
            print(f"{k:>12}: {v:.4f}")
    return metrics

# -------------------------
# SHAP + LIME helpers
# -------------------------
def build_shap_background(model: Pipeline, X_train_df: pd.DataFrame, size=200):
    # Build background from TRAIN ONLY, transformed into the space that XGB saw.
    preproc = model.named_steps["preproc"]
    rng = np.random.RandomState(RANDOM_STATE)
    n = min(size, len(X_train_df))
    if n <= 0:
        return np.empty((0, len(X_train_df.columns)))
    bg_idx = rng.choice(len(X_train_df), size=n, replace=False)
    X_bg = X_train_df.iloc[bg_idx]
    X_bg_trans = preproc.transform(X_bg)
    return np.array(X_bg_trans)

def build_lime_explainer_for_preprocessed(model: Pipeline, X_train_df: pd.DataFrame, feature_names: list):
    if LimeTabularExplainer is None:
        return None
    preproc = model.named_steps["preproc"]
    X_train_trans = preproc.transform(X_train_df)
    explainer = LimeTabularExplainer(
        training_data=np.array(X_train_trans),
        feature_names=feature_names,
        class_names=["NoDefault", "Default"],
        discretize_continuous=True,
        random_state=RANDOM_STATE,
        kernel_width=3.0,
    )
    return explainer

# -------------------------
# MAIN
# -------------------------
if __name__ == "__main__":
    np.random.seed(RANDOM_STATE)

    data_path = os.getenv(
        "UCI_CREDIT_PATH",
        str(Path(__file__).resolve().parents[2] / "data" / "UCI_Credit_Card.csv"),
    )
    print(f"[INFO] Loading data from: {data_path}")
    X, y = load_uci_credit(data_path)

    # Split -> (train+valid) / test
    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )
    # Carve a validation slice out of the train set
    X_train, X_valid, y_train, y_valid = train_test_split(
        X_train_full, y_train_full, test_size=VALID_SIZE, stratify=y_train_full, random_state=RANDOM_STATE
    )

    # Build and train
    pipe, feature_names = build_pipeline(X_train, y_train)

    print("[INFO] Cross-validating...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_auc = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=N_JOBS)
    print(f"[CV] ROC_AUC: mean={cv_auc.mean():.4f} ± {cv_auc.std():.4f}")

    print("[INFO] Fitting on train...")
    pipe.fit(X_train, y_train)

    print("[INFO] Evaluating on validation and test...")
    val_metrics = evaluate(pipe, X_valid, y_valid, name="XGB-Calibrated (Valid)")
    test_metrics = evaluate(pipe, X_test, y_test, name="XGB-Calibrated (Test)")

    # ---------------- SHAP background & sanity check ----------------
    shap_bg = None
    try:
        print("[INFO] Building SHAP background...")
        shap_bg = build_shap_background(pipe, X_train, size=200)
        np.save(ARTIFACT_SHAP_BG, shap_bg)

        if shap is not None:
            print("[INFO] Sanity-checking SHAP on 5 samples...")
            # Locate the fitted XGB inside CalibratedClassifierCV (modern sklearn path)
            calibrated = pipe.named_steps["clf"]
            xgb_fitted = None
            if hasattr(calibrated, "calibrated_classifiers_") and calibrated.calibrated_classifiers_:
                xgb_fitted = calibrated.calibrated_classifiers_[0].estimator
            if xgb_fitted is None:
                xgb_fitted = getattr(calibrated, "base_estimator_", None)
            if xgb_fitted is None and hasattr(calibrated, "estimators_"):
                xgb_fitted = calibrated.estimators_[0].base_estimator
            if xgb_fitted is None:
                raise RuntimeError("Could not locate fitted XGBClassifier inside CalibratedClassifierCV.")

            preproc = pipe.named_steps["preproc"]
            X_sample = preproc.transform(X_test.iloc[:5])
            explainer = shap.TreeExplainer(
                xgb_fitted, feature_perturbation="tree_path_dependent", model_output="probability"
            )
            _ = explainer.shap_values(X_sample)  # run once to verify
        else:
            print("[WARN] SHAP not installed; skipping SHAP sanity check.")
    except Exception as e:
        print(f"[WARN] SHAP background/sanity check failed: {e}")

    # ---------------- LIME explainer ----------------
    lime_explainer = None
    try:
        print("[INFO] Building LIME explainer...")
        lime_explainer = build_lime_explainer_for_preprocessed(pipe, X_train, feature_names)
        if lime_explainer is None:
            print("[WARN] LIME not installed; skipping LIME artifact.")
    except Exception as e:
        print(f"[WARN] LIME setup failed: {e}")

    # ---------------- Save Artifacts ----------------
    print("[INFO] Saving artifacts...")
    joblib.dump(pipe, ARTIFACT_MODEL)
    joblib.dump(pipe.named_steps["preproc"], ARTIFACT_PREPROC)

    # DO NOT pickle the LimeTabularExplainer (contains lambdas, not picklable).
    # Save a small config dict you can use to rebuild at runtime.
    lime_cfg = {
        "discretize_continuous": True,
        "kernel_width": 3.0,
        "class_names": ["NoDefault", "Default"],
        "feature_names": feature_names,
        "note": "Rebuild LimeTabularExplainer at runtime; not pickled due to lambda in discretizer.",
    }
    joblib.dump(lime_cfg, ARTIFACT_LIME)

    with open(ARTIFACT_FEATURES, "w") as f:
        json.dump({"feature_names": feature_names}, f, indent=2)

    meta = {
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "valid_size": VALID_SIZE,
        "cv_roc_auc_mean": float(cv_auc.mean()),
        "cv_roc_auc_std": float(cv_auc.std()),
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "class_balance": {
            "train_pos": int(np.sum(y_train == 1)),
            "train_neg": int(np.sum(y_train == 0)),
        },
    }
    with open(ARTIFACT_METADATA, "w") as f:
        json.dump(meta, f, indent=2)

    # Save a small validation pack you can replay inside the API
    validation_pack = {
        "X_sample": X_test.head(8),
        "y_sample": y_test.head(8).tolist(),
    }
    joblib.dump(validation_pack, ARTIFACT_VALID)

    print("\n✅ Done.")
    print(
        f"Saved: \n- {ARTIFACT_MODEL}\n- {ARTIFACT_PREPROC}\n- {ARTIFACT_LIME} (config dict)"
        f"\n- {ARTIFACT_SHAP_BG}\n- {ARTIFACT_FEATURES}\n- {ARTIFACT_METADATA}\n- {ARTIFACT_VALID}"
    )
