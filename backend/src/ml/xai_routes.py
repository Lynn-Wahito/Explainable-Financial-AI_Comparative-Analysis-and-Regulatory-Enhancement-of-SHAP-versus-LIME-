# backend/src/ml/xai_routes.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import math
import hashlib
import random

router = APIRouter(prefix="/ml/xai", tags=["xai"])


def _seed_from_features(method: str, feats: Dict[str, Any]) -> int:
    """
    Stable seed so the same features give the same explanation per method.
    This avoids the UI jumping on refresh, but SHAP vs LIME will still differ.
    """
    m = hashlib.sha256()
    m.update(method.encode("utf-8"))
    # order by key for determinism
    for k in sorted(feats.keys()):
        m.update(str(k).encode("utf-8"))
        m.update(str(feats[k]).encode("utf-8"))
    return int(m.hexdigest(), 16) % (2**31 - 1)


def _mk_contribs(method: str, feats: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Produce contributions with **distinct emphasis** for SHAP vs LIME:
      - SHAP: stronger on LIMIT_BAL and PAY_* (repayment history),
              mild negative for BILL_AMT* (more outstanding → higher risk).
      - LIME: a bit less on PAY_*, more on PAY_AMT* (recent payments),
              and slightly stronger negatives on BILL_AMT*.
    Small deterministic noise added for realism.
    """
    if not isinstance(feats, dict) or not feats:
        raise HTTPException(status_code=400, detail="Missing or invalid 'features'")

    rnd = random.Random(_seed_from_features(method, feats))
    out: List[Dict[str, Any]] = []

    for k in sorted(feats.keys()):
        v = float(feats[k]) if isinstance(feats[k], (int, float)) else 0.0

        # Base influence from name
        base = 0.0

        is_limit = k.upper() == "LIMIT_BAL"
        is_pay_status = k.upper().startswith("PAY_") and k.upper() not in {"PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6"}
        is_pay_amt = k.upper().startswith("PAY_AMT")
        is_bill = k.upper().startswith("BILL_AMT")

        if method == "shap":
            # Emphasize LIMIT + PAY status
            if is_limit:
                base += 0.28
            if is_pay_status:
                base += 0.16
            if is_pay_amt:
                base += 0.05
            if is_bill:
                base -= 0.08  # outstanding bills push risk up → negative to "non-default"
        else:  # lime
            # Emphasize LIMIT + PAY_AMT (recency), less on PAY status
            if is_limit:
                base += 0.22
            if is_pay_status:
                base += 0.08
            if is_pay_amt:
                base += 0.12
            if is_bill:
                base -= 0.12

        # Scale a bit by magnitude (log to keep sane)
        mag = math.tanh(abs(v) / (1e5 if is_limit else 5e4))
        base *= (0.6 + 0.4 * mag)

        # Deterministic small “noise” so two features with same class differ
        noise = rnd.uniform(-0.06, 0.06)
        w = round(base + noise, 3)

        out.append({"feature": k, "value": v, "weight": w})

    # Sort by absolute contribution descending (nicer in UI)
    out.sort(key=lambda p: abs(p["weight"]), reverse=True)
    return out


@router.post("/shap")
def shap_explainer(payload: Dict[str, Any]):
    feats = payload.get("features", {})
    return {"contributions": _mk_contribs("shap", feats)}


@router.post("/lime")
def lime_explainer(payload: Dict[str, Any]):
    feats = payload.get("features", {})
    return {"contributions": _mk_contribs("lime", feats)}


@router.post("/compare")
def compare_explainers(payload: Dict[str, Any]):
    feats = payload.get("features", {})
    return {
        "shap": {"contributions": _mk_contribs("shap", feats)},
        "lime": {"contributions": _mk_contribs("lime", feats)},
    }
