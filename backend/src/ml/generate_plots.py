# backend/src/ml/generate_plots.py

import os
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

RANDOM_STATE = 42

# -----------------------------
# 1. Load UCI Credit dataset
# -----------------------------
def load_uci_credit_for_plots() -> tuple[pd.DataFrame, pd.Series]:
    """
    Lightweight loader for generating plots only.
    Does NOT modify your training script.
    """
    data_path = os.getenv(
        "UCI_CREDIT_PATH",
        str(Path(__file__).resolve().parents[2] / "data" / "UCI_Credit_Card.csv"),
    )
    print(f"[PLOTS] Loading data from: {data_path}")
    df = pd.read_csv(data_path, engine="python", sep=None, encoding="utf-8-sig")

    # Try common label names
    candidates = [
        "Y",
        "default.payment.next.month",
        "default.payment.nextmonth",
        "default",
        "label",
    ]
    y_col = None
    for c in candidates:
        if c in df.columns:
            y_col = c
            break
    if y_col is None:
        # fallback: assume last column is the label
        y_col = df.columns[-1]

    y = df[y_col]
    X = df.drop(columns=[y_col])
    # Drop common ID column if present
    for drop_col in ["ID", "id", "Id"]:
        if drop_col in X.columns:
            X = X.drop(columns=[drop_col])

    print(f"[PLOTS] Using label column: {y_col}")
    return X, y


# -----------------------------
# 2. Prepare output directory
# -----------------------------
def get_plots_dir() -> Path:
    models_dir = Path(__file__).resolve().parents[1] / "models"
    plots_dir = models_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)
    return plots_dir


# -----------------------------
# 3. Plot helpers
# -----------------------------
def save_dataset_head(X: pd.DataFrame, plots_dir: Path):
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.axis("off")
    head_str = X.head().to_string()
    ax.text(0.01, 0.99, head_str, va="top", ha="left", family="monospace")
    out = plots_dir / "fig5_3_1_dataset_head.png"
    fig.tight_layout()
    fig.savefig(out, dpi=200)
    plt.close(fig)
    print(f"[PLOTS] Saved {out}")


def save_target_distribution(y: pd.Series, plots_dir: Path):
    from collections import Counter

    counts = Counter(y)
    labels = list(counts.keys())
    values = [counts[k] for k in labels]

    fig, ax = plt.subplots(figsize=(5, 4))
    ax.bar(labels, values)
    ax.set_xlabel("Class (0 = non-default, 1 = default)")
    ax.set_ylabel("Number of records")
    ax.set_title("Class Distribution of Target Variable")
    out = plots_dir / "fig5_3_2_target_distribution.png"
    fig.tight_layout()
    fig.savefig(out, dpi=200)
    plt.close(fig)
    print(f"[PLOTS] Saved {out}")


def save_correlation_heatmap(X: pd.DataFrame, plots_dir: Path):
    # Use a subset of columns so the figure is readable
    subset_cols = []
    for c in ["LIMIT_BAL", "AGE", "BILL_AMT1", "BILL_AMT2", "PAY_AMT1", "PAY_AMT2"]:
        if c in X.columns:
            subset_cols.append(c)
    if not subset_cols:
        return

    corr = X[subset_cols].corr()

    fig, ax = plt.subplots(figsize=(6, 5))
    cax = ax.imshow(corr, interpolation="nearest")
    ax.set_xticks(range(len(subset_cols)))
    ax.set_yticks(range(len(subset_cols)))
    ax.set_xticklabels(subset_cols, rotation=45, ha="right")
    ax.set_yticklabels(subset_cols)
    fig.colorbar(cax, ax=ax)
    ax.set_title("Correlation Heatmap (Selected Features)")
    fig.tight_layout()
    out = plots_dir / "fig5_3_3_correlation_heatmap.png"
    fig.savefig(out, dpi=200)
    plt.close(fig)
    print(f"[PLOTS] Saved {out}")


def save_feature_histograms(X: pd.DataFrame, plots_dir: Path):
    # Pick a few important numeric features for plots
    candidates = ["LIMIT_BAL", "AGE", "BILL_AMT1", "PAY_AMT1"]
    cols = [c for c in candidates if c in X.columns]
    if not cols:
        return

    for c in cols:
        fig, ax = plt.subplots(figsize=(5, 4))
        ax.hist(X[c].dropna(), bins=30)
        ax.set_xlabel(c)
        ax.set_ylabel("Frequency")
        ax.set_title(f"Distribution of {c}")
        out = plots_dir / f"fig5_3_hist_{c}.png"
        fig.tight_layout()
        fig.savefig(out, dpi=200)
        plt.close(fig)
        print(f"[PLOTS] Saved {out}")


# -----------------------------
# 4. Main
# -----------------------------
if __name__ == "__main__":
  np.random.seed(RANDOM_STATE)

  X, y = load_uci_credit_for_plots()
  plots_dir = get_plots_dir()

  save_dataset_head(X, plots_dir)
  save_target_distribution(y, plots_dir)
  save_correlation_heatmap(X, plots_dir)
  save_feature_histograms(X, plots_dir)

  print("\n[PLOTS] All figures generated into:", plots_dir)
