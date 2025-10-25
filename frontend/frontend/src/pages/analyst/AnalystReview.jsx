import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/analyst.css";

export default function AnalystReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const analyst = { name: "Sarah Chen", initials: "SC" };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <div id="analystReviewScreen">
      <div className="navbar">
        <div className="logo">CreditAI</div>
        <div className="nav-items">
          <button className="btn btn-secondary" onClick={() => nav("/analyst")}>← Back to Dashboard</button>
          <button className="btn btn-secondary" onClick={toggleTheme}>
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
          <div className="user-profile">
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{analyst.name}</span>
            <div className="avatar">{analyst.initials}</div>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ marginLeft: 0 }}>
        <div className="page-header">
          <h1 className="page-title">Application Analysis: #{id}</h1>
          <p className="page-subtitle">John Smith - $45,000 Personal Loan</p>
        </div>

        {/* Risk banner (theme-aware) */}
        <div className="card">
          <div className="score-banner">
            <div className="score">0.78</div>
            <div className="label">HIGH RISK</div>
            <div className="meta">Model Confidence: 94.2% | XGBoost v2.1</div>
          </div>

          <h3 style={{ margin: "32px 0 20px 0" }}>AI Explanation Comparison</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* SHAP */}
            <ExplainCard
              title="SHAP Analysis"
              color="var(--primary)"
              badge="Score: 8.7/10"
              blocks={[
                { label: "Payment History", value: "+0.32", red: true },
                { label: "Debt-to-Income", value: "+0.28", red: true },
                { label: "Credit Limit", value: "-0.15", red: false },
                { label: "Employment", value: "-0.08", red: false },
              ]}
              meta={[["Processing Time:", "2.3 seconds"], ["Consistency:", "High (87%)"]]}
              placeholder="SHAP Waterfall Chart"
            />
            {/* LIME */}
            <ExplainCard
              title="LIME Analysis"
              color="var(--accent)"
              badge="Score: 7.2/10"
              blocks={[
                { label: "Debt-to-Income", value: "+0.35", red: true },
                { label: "Payment History", value: "+0.29", red: true },
                { label: "Age Factor", value: "-0.12", red: false },
                { label: "Credit Limit", value: "-0.11", red: false },
              ]}
              meta={[["Processing Time:", "1.8 seconds"], ["Consistency:", "Medium (72%)"]]}
              placeholder="LIME Local Explanation"
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
                  <td>87%</td>
                  <td>72%</td>
                  <td style={{ color: "var(--accent)", fontWeight: 800 }}>SHAP</td>
                </tr>
                <tr>
                  <td>Processing Speed</td>
                  <td>2.3s</td>
                  <td>1.8s</td>
                  <td style={{ color: "var(--accent)", fontWeight: 800 }}>LIME</td>
                </tr>
                <tr>
                  <td>Feature Agreement</td>
                  <td colSpan="2" style={{ textAlign: "center" }}>73% (Both identify payment history & DTI as top factors)</td>
                  <td>Good</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "center" }}>
              <button className="btn btn-primary">Proceed with SHAP Analysis</button>
              <button className="btn btn-secondary">Use LIME Analysis</button>
              <button className="btn btn-secondary" onClick={() => nav("/analyst")}>Back to Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExplainCard({ title, color, badge, blocks, meta, placeholder }) {
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h4 style={{ color }}>{title}</h4>
        <span style={{ background: color, color: "#fff", padding: "4px 12px", borderRadius: 6, fontSize: ".75rem", fontWeight: 700 }}>
          {badge}
        </span>
      </div>

      <div className="explain-placeholder" style={{ height: 180, marginBottom: 20 }}>
        {placeholder}
      </div>

      <div>
        {blocks.map((b, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: 12, borderRadius: 8, marginBottom: 8,
            background: b.red ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)"
          }}>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{b.label}</span>
            <span style={{ fontWeight: 800, color: b.red ? "var(--danger)" : "var(--success)" }}>{b.value}</span>
          </div>
        ))}
      </div>

      <div className="info-banner" style={{ marginTop: 16 }}>
        <strong>{meta[0][0]}</strong> {meta[0][1]}<br />
        <strong>{meta[1][0]}</strong> {meta[1][1]}
      </div>
    </div>
  );
}
