# backend/src/ml/model_utils.py
import os
import pickle
from typing import List, Optional, Tuple

try:
    import joblib  # type: ignore
except Exception:  # joblib might not be installed in some envs
    joblib = None


def _project_root() -> str:
    """
    Returns the absolute path to the backend project root:
    backend/ (where src/, models/, artifacts/ live).
    """
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def default_model_candidates() -> List[str]:
    """
    Candidate model paths in priority order. Adjust if you save to different names.
    """
    root = _project_root()
    return [
        os.path.join(root, "models", "xgb_credit.pkl"),
        os.path.join(root, "artifacts", "xgb_model.joblib"),
        os.path.join(root, "artifacts", "xgb_model.pkl"),
    ]


def find_candidate_model_paths(extra: Optional[List[str]] = None) -> List[str]:
    """
    Combine default candidates with optional extra user-provided paths.
    Remove duplicates while preserving order.
    """
    seen = set()
    candidates = default_model_candidates()
    if extra:
        candidates.extend(extra)

    ordered_unique = []
    for p in candidates:
        ap = os.path.abspath(p)
        if ap not in seen:
            seen.add(ap)
            ordered_unique.append(ap)
    return ordered_unique


def load_model_from_path(path: str):
    """
    Load a model from a given path using either pickle or joblib (if available).
    Raises Exception on failure.
    """
    if path.lower().endswith(".joblib"):
        if joblib is None:
            raise RuntimeError("joblib is not available to load .joblib models")
        return joblib.load(path)
    # fallback: pickle
    with open(path, "rb") as f:
        return pickle.load(f)


def load_model_safe(path: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Safe loader used by /ml/info to verify the model can be deserialized.

    Returns:
        (ok, model_type_str)
        - ok: True if load succeeded, else False
        - model_type_str: string of type(model) if ok, else None
    """
    if not path or not os.path.exists(path):
        return (False, None)
    try:
        m = load_model_from_path(path)
        return (True, str(type(m)))
    except Exception:
        return (False, None)


def load_first_existing_model(extra: Optional[List[str]] = None) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Iterate candidate paths and return the first loadable model.

    Returns:
        (ok, model_path, model_type_str)
    """
    for p in find_candidate_model_paths(extra):
        if os.path.exists(p):
            ok, t = load_model_safe(p)
            if ok:
                return (True, p, t)
    return (False, None, None)


def get_feature_schema() -> List[str]:
    """
    The exact input order expected by the /ml/predict endpoint and your training pipeline.
    Keep this in sync with src/ml/train_pipeline.py & src/ml/predict_api.py
    """
    return [
        "LIMIT_BAL", "SEX", "EDUCATION", "MARRIAGE", "AGE",
        "PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6",
        "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6",
        "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6",
    ]


def get_artifacts_dir() -> str:
    return os.path.join(_project_root(), "artifacts")


def get_models_dir() -> str:
    return os.path.join(_project_root(), "models")
