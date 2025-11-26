// src/pages/analyst/AnalystReview.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/analyst.css";

const API_BASE = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("access_token") || "";
}

const commonHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${getToken()}`,
});

function handleAuthFail(res, nav) {
  if ([401, 403].includes(res.status)) {
    localStorage.removeItem("access_token");
    nav("/login");
    return true;
  }
  return false;
}

// Try to pull UCI-style features from the application payload
function extractFeaturesFromApp(app) {
  if (!app) return null;
  if (app.uci_features) return app.uci_features;
  if (app.features_uci) return app.features_uci;
  if (app.features) return app.features;
  // last resort – if application already stored in ML format
  return app;
}

// Build blocks for the ExplainCard from SHAP / LIME results
function buildBlocksFromXai(xai) {
  if (!xai) return null;

  const rawList =
    xai.top_features ||
    xai.local_explanations ||
    xai.explanations ||
    xai.features ||
    [];

  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  return rawList.slice(0, 6).map((f, idx) => {
    const featName = f.feature || f.name || f.column || `Feature ${idx + 1}`;
    const featValue =
      f.value ?? f.feature_value ?? f.input ?? f.raw_value ?? "";

    const contribRaw =
      f.contribution ?? f.shap_value ?? f.weight ?? f.importance ?? 0;
    const contribNum = Number(contribRaw) || 0;
    const contribStr = (contribNum >= 0 ? "+" : "") + contribNum.toFixed(2);

    let valueStr = "";
    if (featValue !== "" && featValue !== null && featValue !== undefined) {
      const maybeNum = Number(featValue);
      if (Number.isFinite(maybeNum)) {
        valueStr = maybeNum.toFixed(2);
      } else {
        valueStr = String(featValue);
      }
    }

    return {
      label: valueStr ? `${featName} = ${valueStr}` : featName,
      value: contribStr,
      red: contribNum > 0, // positive -> pushes towards risky
    };
  });
}

export default function AnalystReview() {
  const { id } = useParams();
  const nav = useNavigate();

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [mlResult, setMlResult] = useState(null);
  const [shapResult, setShapResult] = useState(null);
  const [limeResult, setLimeResult] = useState(null);
  const analyst = { name: "Sarah Chen", initials: "SC" };

  // Theme handling
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // Fetch the application details for this id
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/analyst/applications/${id}`, {
          method: "GET",
          headers: commonHeaders(),
          cache: "no-store",
        });

        if (handleAuthFail(res, nav)) return;
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load application");

        setApplication(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load application");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Run AI analysis when user clicks the button
  async function runAnalysis() {
    if (!application) return;
    const features = extractFeaturesFromApp(application);

    if (!features) {
      setError("No ML feature vector found for this application.");
      return;
    }

    try {
      setError("");
      // 1) Prediction – flat features at the root
      const predictRes = await fetch(`${API_BASE}/ml/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...commonHeaders() },
        body: JSON.stringify(features),
        cache: "no-store",
      });

      if (handleAuthFail(predictRes, nav)) return;
      const predictData = await predictRes.json();
      if (!predictRes.ok) throw new Error(predictData.detail || "Prediction failed");
      setMlResult(predictData);

      // 2) SHAP and LIME – wrapper with features + model_name
      const payloadXai = { features, model_name: "xgb" };

      const [shapRes, limeRes] = await Promise.all([
        fetch(`${API_BASE}/ml/xai/shap`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...commonHeaders() },
          body: JSON.stringify(payloadXai),
          cache: "no-store",
        }),
        fetch(`${API_BASE}/ml/xai/lime`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...commonHeaders() },
          body: JSON.stringify(payloadXai),
          cache: "no-store",
        }),
      ]);

      if (handleAuthFail(shapRes, nav) || handleAuthFail(limeRes, nav)) return;

      const shapData = await shapRes.json();
      const limeData = await limeRes.json();

      if (!shapRes.ok) throw new Error(shapData.detail || "SHAP analysis failed");
      if (!limeRes.ok) throw new Error(limeData.detail || "LIME analysis failed");

      setShapResult(shapData);
      setLimeResult(limeData);
    } catch (e) {
      console.error(e);
      setError(e.message || "AI analysis failed");
    }
  }

  // Derive display fields from ML result
  let scoreValue = "—";
  let scoreLabel = "NOT ANALYSED";
  let scoreMeta = "Run AI analysis to see the risk score.";
  if (mlResult) {
    const rawProb =
      typeof mlResult.probability === "number"
        ? mlResult.probability
        : typeof mlResult.risk_score === "number"
        ? mlResult.risk_score
        : null;

    if (rawProb !== null) {
      const p = rawProb <= 1 ? rawProb : rawProb / 100; // handle 0–1 or 0–100
      scoreValue = p.toFixed(2);

      if (p < 0.3) scoreLabel = "LOW/MED RISK";
      else if (p < 0.7) scoreLabel = "MEDIUM RISK";
      else scoreLabel = "HIGH RISK";

      const percent = (p * 100).toFixed(1);
      scoreMeta = `Model Probability (risky): ${percent}% | ${
        mlResult.model || "XGBoost"
      }`;
    }
  }

  const applicantName =
    application?.customer_name ||
    `${application?.full_name || ""}`.trim() ||
    "Applicant";
  const loanAmount =
    typeof application?.amount === "number"
      ? application.amount
      : application?.loan_amount;
  const amountLabel =
    loanAmount != null ? `Ksh ${Number(loanAmount).toLocaleString()}` : "";

  // Build SHAP / LIME blocks from real API data (or fallback to static placeholders)
  const shapBlocks =
    buildBlocksFromXai(shapResult) || [
      { label: "Payment History", value: "+0.32", red: true },
      { label: "Debt-to-Income", value: "+0.28", red: true },
      { label: "Credit Limit", value: "-0.15", red: false },
      { label: "Employment", value: "-0.08", red: false },
    ];

  const limeBlocks =
    buildBlocksFromXai(limeResult) || [
      { label: "Debt-to-Income", value: "+0.35", red: true },
      { label: "Payment History", value: "+0.29", red: true },
      { label: "Age Factor", value: "-0.12", red: false },
      { label: "Credit Limit", value: "-0.11", red: false },
    ];

  const shapTime =
    shapResult?.runtime_ms ??
    shapResult?.time_ms ??
    shapResult?.duration_ms ??
    null;
  const limeTime =
    limeResult?.runtime_ms ??
    limeResult?.time_ms ??
    limeResult?.duration_ms ??
    null;

  const shapConsistency =
    shapResult?.consistency ??
    shapResult?.stability ??
    shapResult?.global_consistency ??
    null;
  const limeConsistency =
    limeResult?.consistency ??
    limeResult?.stability ??
    limeResult?.global_consistency ??
    null;

  const featureAgreement =
    shapResult?.feature_agreement ??
    limeResult?.feature_agreement ??
    null;

  if (!getToken()) {
    return <div className="analyst-scope">No session. Redirecting to login…</div>;
  }

  return (
    <div id="analystReviewScreen">
      <div className="navbar">
        <div className="logo">CreditAI</div>
        <div className="nav-items">
          <button
            className="btn btn-secondary"
            onClick={() => nav("/analyst")}
          >
            ← Back to Dashboard
          </button>
          <button className="btn btn-secondary" onClick={toggleTheme}>
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
          <div className="user-profile">
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {analyst.name}
            </span>
            <div className="avatar">{analyst.initials}</div>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ marginLeft: 0 }}>
        <div className="page-header">
          <h1 className="page-title">Application Analysis: {id}</h1>
          <p className="page-subtitle">
            {applicantName}
            {amountLabel ? ` — ${amountLabel}` : ""}
          </p>
          {error && (
            <div className="alert alert-warn" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>

        <div className="card">
          {/* Risk banner driven by real model output */}
          <div className="score-banner">
            <div className="score">{scoreValue}</div>
            <div className="label">{scoreLabel}</div>
            <div className="meta">{scoreMeta}</div>
          </div>

          <h3 style={{ margin: "32px 0 20px 0" }}>AI Explanation Comparison</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
            }}
          >
            {/* SHAP */}
            <ExplainCard
              title="SHAP Analysis"
              color="var(--primary)"
              badge={shapResult ? "Loaded from API" : "Waiting for analysis"}
              blocks={shapBlocks}
              meta={[
                [
                  "Processing Time:",
                  shapTime != null ? `${shapTime} ms` : "—",
                ],
                [
                  "Consistency:",
                  shapConsistency != null ? `${shapConsistency}` : "—",
                ],
              ]}
              placeholder="SHAP Explanation"
            />

            {/* LIME */}
            <ExplainCard
              title="LIME Analysis"
              color="var(--accent)"
              badge={limeResult ? "Loaded from API" : "Waiting for analysis"}
              blocks={limeBlocks}
              meta={[
                [
                  "Processing Time:",
                  limeTime != null ? `${limeTime} ms` : "—",
                ],
                [
                  "Consistency:",
                  limeConsistency != null ? `${limeConsistency}` : "—",
                ],
              ]}
              placeholder="LIME Explanation"
            />
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <h4 style={{ marginBottom: 16 }}>Comparison Summary</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>SHAP</th>
                  <th>LIME</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Feature Consistency</td>
                  <td>{shapConsistency != null ? shapConsistency : "—"}</td>
                  <td>{limeConsistency != null ? limeConsistency : "—"}</td>
                  <td style={{ color: "var(--accent)", fontWeight: 800 }}>
                    {shapConsistency != null && limeConsistency != null
                      ? shapConsistency > limeConsistency
                        ? "SHAP"
                        : shapConsistency < limeConsistency
                        ? "LIME"
                        : "Tie"
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td>Processing Speed</td>
                  <td>{shapTime != null ? `${shapTime} ms` : "—"}</td>
                  <td>{limeTime != null ? `${limeTime} ms` : "—"}</td>
                  <td style={{ color: "var(--accent)", fontWeight: 800 }}>
                    {shapTime != null && limeTime != null
                      ? shapTime < limeTime
                        ? "SHAP"
                        : shapTime > limeTime
                        ? "LIME"
                        : "Tie"
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td>Feature Agreement</td>
                  <td colSpan="2" style={{ textAlign: "center" }}>
                    {featureAgreement != null
                      ? `${featureAgreement} (overlap between SHAP & LIME top features)`
                      : "—"}
                  </td>
                  <td>
                    {featureAgreement != null
                      ? featureAgreement >= 0.7
                        ? "Good"
                        : featureAgreement >= 0.4
                        ? "Moderate"
                        : "Low"
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 24,
                justifyContent: "center",
              }}
            >
              {/* This is your “Analyze” button now */}
              <button
                className="btn btn-primary"
                onClick={runAnalysis}
                disabled={loading}
              >
                {mlResult ? "Re-run AI Analysis" : "Run AI Analysis"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => nav("/analyst")}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExplainCard({ title, color, badge, blocks, meta, placeholder }) {
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h4 style={{ color }}>{title}</h4>
        <span
          style={{
            background: color,
            color: "#fff",
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: ".75rem",
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      </div>

      <div
        className="explain-placeholder"
        style={{ height: 180, marginBottom: 20 }}
      >
        {placeholder}
      </div>

      <div>
        {blocks.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 12,
              borderRadius: 8,
              marginBottom: 8,
              background: b.red
                ? "rgba(239, 68, 68, 0.12)"
                : "rgba(16, 185, 129, 0.12)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {b.label}
            </span>
            <span
              style={{
                fontWeight: 800,
                color: b.red ? "var(--danger)" : "var(--success)",
              }}
            >
              {b.value}
            </span>
          </div>
        ))}
      </div>

      <div className="info-banner" style={{ marginTop: 16 }}>
        <strong>{meta[0][0]}</strong> {meta[0][1]}
        <br />
        <strong>{meta[1][0]}</strong> {meta[1][1]}
      </div>
    </div>
  );
}
