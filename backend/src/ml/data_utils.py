# backend/src/ml/data_utils.py
import os
import pandas as pd

def read_credit_csv(path: str):
    """
    Read UCI Credit Card dataset and normalize headers to a standard schema.

    Supports:
    - Official headers: LIMIT_BAL, PAY_0..PAY_6, BILL_AMT1..6, PAY_AMT1..6, DEFAULT
    - 'DEFAULT.PAYMENT.NEXT.MONTH' -> DEFAULT
    - X1..X23, Y variant -> mapped to official headers
    - Drops 'ID' and 'Unnamed' index columns
    - Uppercases and underscores headers
    """
    abs_path = os.path.abspath(path)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Dataset not found at: {abs_path}")

    try:
        df = pd.read_csv(abs_path)
    except Exception:
        df = pd.read_csv(abs_path, sep=";")

    # If there's only one giant column (bad delimiter)
    if len(df.columns) == 1:
        df = pd.read_csv(abs_path, sep=None, engine="python")

    # Strip & normalize header style early
    norm = lambda c: c.strip().replace(" ", "_").replace(".", "_").upper()
    df.columns = [norm(c) for c in df.columns]

    # Drop typical junk index columns
    for junk in ["UNNAMED:_0", "UNNAMED_0", "INDEX", "ROW", "ROWID"]:
        if junk in df.columns:
            df = df.drop(columns=[junk])

    # If CSV is the X1..X23 + Y variant, remap to official schema
    x_cols = [f"X{i}" for i in range(1, 24)]
    has_x_schema = all(col in df.columns for col in x_cols) and ("Y" in df.columns)
    if has_x_schema:
        mapping = {
            "X1":  "LIMIT_BAL",
            "X2":  "SEX",
            "X3":  "EDUCATION",
            "X4":  "MARRIAGE",
            "X5":  "AGE",
            "X6":  "PAY_0",
            "X7":  "PAY_2",
            "X8":  "PAY_3",
            "X9":  "PAY_4",
            "X10": "PAY_5",
            "X11": "PAY_6",
            "X12": "BILL_AMT1",
            "X13": "BILL_AMT2",
            "X14": "BILL_AMT3",
            "X15": "BILL_AMT4",
            "X16": "BILL_AMT5",
            "X17": "BILL_AMT6",
            "X18": "PAY_AMT1",
            "X19": "PAY_AMT2",
            "X20": "PAY_AMT3",
            "X21": "PAY_AMT4",
            "X22": "PAY_AMT5",
            "X23": "PAY_AMT6",
            "Y":   "DEFAULT",
        }
        df = df.rename(columns=mapping)

    # Drop ID if present
    if "ID" in df.columns:
        df = df.drop(columns=["ID"])

    # Normalize target variants -> DEFAULT
    rename_map = {
        "DEFAULT_PAYMENT_NEXT_MONTH": "DEFAULT",
        "DEFAULT_PAYMENT_NEXT": "DEFAULT",
        "DEFAULT_PAYMENT": "DEFAULT",
        "DEFAULT_PAYMENT_NEXT_MONTH_": "DEFAULT",
        "DEFAULT_PAYMENT_NEXT_MONTHS": "DEFAULT",
        "DEFAULT_PAYMENT_NEXT_MONTH ": "DEFAULT",
        "DEFAULT_PAYMENT_NEXT_MONTH.": "DEFAULT",
        "DEFAULT_PAYMENT_NEXT.MONTH": "DEFAULT",
        "DEFAULT.PAYMENT.NEXT.MONTH": "DEFAULT",
    }
    for old, new in list(rename_map.items()):
        if old in df.columns and new not in df.columns:
            df = df.rename(columns={old: new})

    # Some releases have PAY_1..PAY_6 instead of PAY_0..PAY_6 — shift down if needed
    if "PAY_0" not in df.columns and "PAY_1" in df.columns and "PAY_2" in df.columns:
        rename_shift = {}
        for i in range(6, 0, -1):  # 6..1 -> 5..0
            src = f"PAY_{i}"
            dst = f"PAY_{i-1}"
            if src in df.columns:
                rename_shift[src] = dst
        df = df.rename(columns=rename_shift)

    required = [
        "LIMIT_BAL", "SEX", "EDUCATION", "MARRIAGE", "AGE",
        "PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6",
        "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6",
        "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6",
        "DEFAULT",
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            "Missing required columns: "
            f"{missing}\nFound columns: {list(df.columns)}"
        )

    # Coerce numeric (everything except DEFAULT)
    numeric_cols = [c for c in df.columns if c != "DEFAULT"]
    df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric, errors="coerce")

    return df, "DEFAULT"
