import os
import json
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib

# Define paths
DATA_PATH = os.path.join("..", "..", "data", "UCI_Credit_Card.xls")   # adjust name if .xlsx
ARTIFACT_DIR = os.path.join("..", "..", "artifacts")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def load_dataset(path):
    """Load dataset from Excel file (supports .xls and .xlsx)."""
    file_ext = os.path.splitext(path)[-1].lower()
    if file_ext == ".xlsx":
        return pd.read_excel(path, engine="openpyxl")
    elif file_ext == ".xls":
        return pd.read_excel(path, engine="xlrd")
    else:
        raise ValueError("Unsupported file format. Please use .xls or .xlsx")

def preprocess_and_save():
    # 1. Load dataset
    df = load_dataset(DATA_PATH)
    print(f"✅ Dataset loaded successfully with shape: {df.shape}")
    print("Columns in dataset:", df.columns.tolist())

    # 2. Handle target column
    if 'default.payment.next.month' in df.columns:
        df = df.rename(columns={'default.payment.next.month':'default'})
    elif 'Y' in df.columns:
        df = df.rename(columns={'Y':'default'})

        # Drop useless columns
        if 'Unnamed: 0' in df.columns:
            df = df.drop(columns=['Unnamed: 0'])

        # Convert target to numeric safely
        df['default'] = pd.to_numeric(df['default'], errors='coerce')
        df = df.dropna(subset=['default'])
        df['default'] = df['default'].astype(int)

    # 3. Feature engineering
    if 'BILL_AMT1' in df.columns and 'LIMIT_BAL' in df.columns:
        df['UTILIZATION'] = df['BILL_AMT1'] / df['LIMIT_BAL'].replace(0,1)
    pay_cols = [c for c in df.columns if c.startswith("PAY_")]
    if pay_cols:
        df['PAYMENT_CONSISTENCY'] = (df[pay_cols] > 0).sum(axis=1)

    # 4. Train-test split
    X = df.drop(columns=['default'])
    y = df['default'].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    # 5. Scaling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 6. Save artifacts
    joblib.dump(scaler, os.path.join(ARTIFACT_DIR, "scaler.joblib"))
    joblib.dump(X_train, os.path.join(ARTIFACT_DIR, "X_train.joblib"))
    joblib.dump(y_train, os.path.join(ARTIFACT_DIR, "y_train.joblib"))
    joblib.dump(X_test, os.path.join(ARTIFACT_DIR, "X_test.joblib"))
    joblib.dump(y_test, os.path.join(ARTIFACT_DIR, "y_test.joblib"))

    feature_means = X_train.mean().to_dict()
    with open(os.path.join(ARTIFACT_DIR, "feature_means.json"), "w") as f:
        json.dump(feature_means, f)

    print(f"✅ Preprocessing complete. Artifacts saved in: {ARTIFACT_DIR}")

if __name__ == "__main__":
    preprocess_and_save()
