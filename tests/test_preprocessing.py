import os, joblib, json

ARTIFACT_DIR = "artifacts"

def test_artifacts_exist():
    expected_files = [
        "scaler.joblib", "X_train.joblib", "X_test.joblib",
        "y_train.joblib", "y_test.joblib", "feature_means.json"
    ]
    for f in expected_files:
        path = os.path.join(ARTIFACT_DIR, f)
        assert os.path.exists(path), f"{f} is missing"

def test_dataset_shapes():
    X_train = joblib.load(os.path.join(ARTIFACT_DIR, "X_train.joblib"))
    y_train = joblib.load(os.path.join(ARTIFACT_DIR, "y_train.joblib"))
    assert len(X_train) == len(y_train), "Mismatch between X_train and y_train sizes"

def test_target_distribution():
    y_train = joblib.load(os.path.join(ARTIFACT_DIR, "y_train.joblib"))
    assert set(y_train.unique()) <= {0, 1}, "Target values should only be 0 or 1"

def test_feature_means():
    with open(os.path.join(ARTIFACT_DIR, "feature_means.json")) as f:
        means = json.load(f)
    assert isinstance(means, dict), "Feature means should be a dictionary"
    assert len(means) > 0, "Feature means dictionary is empty"
