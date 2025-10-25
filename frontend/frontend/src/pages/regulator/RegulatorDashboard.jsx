// src/pages/regulator/RegulatorDashboard.jsx
import React, { useState } from "react";
import "../../styles/regulator.css";

export default function RegulatorDashboard() {
  const [theme, setTheme] = useState("dark"); // "dark" | "light"
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "audit" | "reports" | "fair" | "settings" | "model"

  // Mock data for Audit Trail table
  const auditRows = [
    {
      timestamp: "2024-09-21 14:23",
      id: "#LN-2024-003",
      decision: "Under Review",
      decisionType: "pending",
      method: "SHAP",
      score: "9.4/10",
      officer: "Sarah Chen",
    },
    {
      timestamp: "2024-09-21 14:15",
      id: "#LN-2024-004",
      decision: "Approved",
      decisionType: "approved",
      method: "LIME",
      score: "8.8/10",
      officer: "Michael Torres",
    },
    {
      timestamp: "2024-09-21 14:08",
      id: "#LN-2024-005",
      decision: "Declined",
      decisionType: "declined",
      method: "SHAP + LIME",
      score: "6.2/10",
      officer: "Sarah Chen",
    },
  ];

  return (
    <div className={`reg-scope theme-${theme}`}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">CreditAI</div>

        <div className="nav-items">
          <button className="nav-link" onClick={() => setActiveView("dashboard")}>
            Dashboard
          </button>
          <button className="nav-link" onClick={() => setActiveView("dashboard")}>
            Compliance
          </button>
          <button className="nav-link" onClick={() => setActiveView("audit")}>
            Audit Trail
          </button>
          <button className="nav-link" onClick={() => setActiveView("reports")}>
            Reports
          </button>

          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
          </button>

          <div className="user-profile">
            <span className="user-name">Dr. Amanda Rodriguez</span>
            <div className="avatar">AR</div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <button
          className={`sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveView("dashboard")}
        >
          📊 Compliance Dashboard
        </button>
        <button
          className={`sidebar-item ${activeView === "audit" ? "active" : ""}`}
          onClick={() => setActiveView("audit")}
        >
          📋 Audit Trail
        </button>
        <button
          className={`sidebar-item ${activeView === "model" ? "active" : ""}`}
          onClick={() => setActiveView("model")}
        >
          🔍 Model Validation
        </button>
        <button
          className={`sidebar-item ${activeView === "reports" ? "active" : ""}`}
          onClick={() => setActiveView("reports")}
        >
          📈 Reports
        </button>
        <button
          className={`sidebar-item ${activeView === "fair" ? "active" : ""}`}
          onClick={() => setActiveView("fair")}
        >
          ⚖️ Fair Lending
        </button>
        <button
          className={`sidebar-item ${activeView === "settings" ? "active" : ""}`}
          onClick={() => setActiveView("settings")}
        >
          ⚙️ Settings
        </button>
        <button className="sidebar-item">🚪 Logout</button>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* DASHBOARD VIEW */}
        {activeView === "dashboard" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Regulatory Compliance Dashboard</h1>
              <p className="page-subtitle">Monitor AI model compliance and audit trails</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value accent">96%</div>
                <div className="stat-label">GDPR Compliance</div>
              </div>
              <div className="stat-card">
                <div className="stat-value accent">100%</div>
                <div className="stat-label">Explainability Coverage</div>
              </div>
              <div className="stat-card">
                <div className="stat-value warning">3</div>
                <div className="stat-label">Audit Flags</div>
              </div>
              <div className="stat-card">
                <div className="stat-value primary">847</div>
                <div className="stat-label">Decisions Today</div>
              </div>
            </div>

            {/* Compliance Status */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Compliance Status</h3>
                <button className="btn btn-primary">Generate Report</button>
              </div>

              <div className="split-2">
                <div className="box box-success">
                  <h4 className="box-title">✓ Compliant Areas</h4>
                  <div className="box-text">
                    • Model Explainability (SHAP/LIME) <br />
                    • Data Privacy Protection <br />
                    • Decision Audit Trail <br />
                    • FCRA Compliance <br />
                    • Fair Lending Practices
                  </div>
                </div>

                <div className="box box-warning">
                  <h4 className="box-title">⚠️ Needs Attention</h4>
                  <div className="box-text">
                    • Bias Testing (Quarterly review pending) <br />
                    • Documentation Update (2 policies) <br />
                    • Model Retraining Schedule
                  </div>
                </div>
              </div>
            </div>

            {/* Model Performance */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Model Performance Monitoring</h3>
              </div>

              <div className="split-3">
                <div className="kpi-tile">
                  <div className="kpi-value primary">89.2%</div>
                  <div className="kpi-label">Model Accuracy</div>
                </div>
                <div className="kpi-tile">
                  <div className="kpi-value accent">0.91</div>
                  <div className="kpi-label">AUC-ROC Score</div>
                </div>
                <div className="kpi-tile">
                  <div className="kpi-value warning">2.3%</div>
                  <div className="kpi-label">Bias Detection</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT TRAIL */}
        {activeView === "audit" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Recent Audit Trail</h1>
              <p className="page-subtitle">Full traceability of credit decisions</p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Audit Trail</h3>
                <button className="btn btn-secondary">Export Full Log</button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Application ID</th>
                    <th>Decision</th>
                    <th>Explanation Method</th>
                    <th>Compliance Score</th>
                    <th>Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.timestamp}</td>
                      <td>{row.id}</td>
                      <td>
                        <span
                          className={`badge ${
                            row.decisionType === "approved"
                              ? "badge-approved"
                              : row.decisionType === "declined"
                              ? "badge-declined"
                              : "badge-pending"
                          }`}
                        >
                          {row.decision}
                        </span>
                      </td>
                      <td>{row.method}</td>
                      <td className="strong accent">{row.score}</td>
                      <td>{row.officer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS / FAIR LENDING / MODEL / SETTINGS (simple placeholders for now) */}
        {activeView === "reports" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Reports</h1>
              <p className="page-subtitle">Export periodic compliance and performance reports</p>
            </div>
            <div className="card">
              <p style={{ color: "var(--muted)" }}>Coming soon…</p>
            </div>
          </div>
        )}

        {activeView === "fair" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Fair Lending</h1>
              <p className="page-subtitle">Ensure fairness and non-discrimination in decisions</p>
            </div>
            <div className="card">
              <p style={{ color: "var(--muted)" }}>Coming soon…</p>
            </div>
          </div>
        )}

        {activeView === "model" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Model Validation</h1>
              <p className="page-subtitle">Monitor XAI configuration and validation metrics</p>
            </div>
            <div className="card">
              <p style={{ color: "var(--muted)" }}>Coming soon…</p>
            </div>
          </div>
        )}

        {activeView === "settings" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Settings</h1>
              <p className="page-subtitle">Manage regulator account and compliance settings</p>
            </div>
            <div className="card">
              <p style={{ color: "var(--muted)" }}>Coming soon…</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
