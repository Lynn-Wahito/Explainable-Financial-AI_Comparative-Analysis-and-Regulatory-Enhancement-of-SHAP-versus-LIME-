import shap
import numpy as np
import matplotlib.pyplot as plt
import io, base64

def explain_shap(model, X_sample, X_train):
    """
    Generate SHAP explanation for XGBClassifier model using TreeExplainer.
    Returns a dict with base64 PNG plot and top features.
    """
    try:
        # ✅ TreeExplainer is made for XGBoost models (fast + stable)
        explainer = shap.TreeExplainer(
            model,
            feature_perturbation="interventional",
            model_output="probability"
        )

        # Compute SHAP values for the single instance
        shap_values = explainer(X_sample)

        # Create summary plot (single instance)
        plt.figure()
        shap.plots.waterfall(shap_values[0], show=False)
        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        plt.close()

        plot_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        # Sort features by importance
        importance = np.abs(shap_values.values[0])
        top_idx = np.argsort(importance)[::-1][:5]
        top_features = [
            {"feature": f, "importance": float(importance[i])}
            for i, f in zip(top_idx, np.array(shap_values.feature_names)[top_idx])
        ]

        return {
            "method": "SHAP",
            "top_features": top_features,
            "plot_png_base64": plot_b64
        }

    except Exception as e:
        raise RuntimeError(f"SHAP failed: {type(e).__name__}: {e}")


def explain_lime(model, X_sample, X_train):
    """
    Placeholder for LIME (keep your existing LIME implementation here).
    """
    try:
        from lime.lime_tabular import LimeTabularExplainer

        explainer = LimeTabularExplainer(
            X_train.values,
            feature_names=X_train.columns,
            class_names=["No Default", "Default"],
            mode="classification"
        )

        exp = explainer.explain_instance(
            X_sample.values[0],
            model.predict_proba,
            num_features=5
        )

        img = exp.as_pyplot_figure()
        buf = io.BytesIO()
        img.savefig(buf, format="png", bbox_inches="tight")
        plt.close()

        plot_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        top_features = [
            {"feature": f, "importance": float(v)}
            for f, v in exp.as_list()[:5]
        ]

        return {
            "method": "LIME",
            "top_features": top_features,
            "plot_png_base64": plot_b64
        }

    except Exception as e:
        raise RuntimeError(f"LIME failed: {type(e).__name__}: {e}")
