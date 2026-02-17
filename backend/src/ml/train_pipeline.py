# backend/src/ml/train_pipeline.py
import argparse
import os
import joblib
import numpy as np
from .data_utils import read_credit_csv
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, roc_auc_score

def train(data_path: str):
    print(f"[INFO] Reading dataset: {os.path.abspath(data_path)}")
    df, target_col = read_credit_csv(data_path)

    # --- NEW: sanitize target column ---
    # normalize case/whitespace to catch accidental text rows
    df[target_col] = (
        df[target_col]
        .astype(str)
        .str.strip()
        .str.lower()
        .replace({
            "y": "1",
            "n": "0",
            "yes": "1",
            "no": "0",
            "default payment next month": np.nan,  # if a stray header is inside rows
            "default": np.nan,
        })
    )
    # coerce to numeric
    df[target_col] = pd.to_numeric(df[target_col], errors="coerce")
    # drop any rows where target is NaN after coercion
    before = len(df)
    df = df.dropna(subset=[target_col])
    after = len(df)
    if after < before:
        print(f"[WARN] Dropped {before - after} rows with invalid target values")

    # Ensure target is integer 0/1
    df[target_col] = df[target_col].astype(int)

    X = df.drop(columns=[target_col])
    y = df[target_col].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        n_jobs=-1,
        eval_metric="logloss",
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, proba)
    print("[METRIC] ROC-AUC:", round(auc, 4))
    print("[REPORT]\n", classification_report(y_test, preds, digits=4))

    os.makedirs("models", exist_ok=True)
    model_path = os.path.abspath("models/xgb_credit.pkl")
    joblib.dump({"model": model, "features": list(X.columns)}, model_path)
    print("✅ Saved model to:", model_path)

if __name__ == "__main__":
    import pandas as pd  # ensure pandas is imported for the new lines
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    args = parser.parse_args()
    train(args.data)
