// src/pages/regulator/RegulatorDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/regulator.css";

export default function RegulatorDashboard() {
  const [theme, setTheme] = useState("dark"); // "dark" | "light"
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "audit" | "reports" | "fair" | "settings" | "model"
  const navigate = useNavigate();

  // --- auth helpers (adapt to your app’s keys) ---
  const getToken = () => localStorage.getItem("access_token");
  const getRole = () => localStorage.getItem("role"); // ensure you set this at login: "regulator"

  // Guard: kick out if no token or wrong role
  useEffect(() => {
    const t = getToken();
    const r = getRole();
    if (!t || r !== "regulator") {
      navigate("/login", { replace: true }); // <-- change route if needed
    }
  }, [navigate]);

  // Logout: clear auth + navigate to login
  const handleLogout = () => {
    try {
      // If your backend has an invalidate endpoint, call it here (optional).
      // await fetch(`${API}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("role");
      // If you stash any user profile info, clear it too:
      // localStorage.removeItem("user");

      navigate("/login", { replace: true }); // <-- change to your actual login route
    } catch (e) {
      // Even if an API logout fails, force local logout:
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  };

  // Mock data for Audit Trail table
  const auditRows = [
    { timestamp: "2024-09-21 14:23", id: "#LN-2024-003", decision: "Under Review", decisionType: "pending", method: "SHAP", score: "9.4/10", officer: "Sarah Chen" },
    { timestamp: "2024-09-21 14:15", id: "#LN-2024-004", decision: "Approved", decisionType: "approved", method: "LIME", score: "8.8/10", officer: "Michael Torres" },
    { timestamp: "2024-09-21 14:08", id: "#LN-2024-005", decision: "Declined", decisionType: "declined", method: "SHAP + LIME", score: "6.2/10", officer: "Sarah Chen" },
  ];

  return (
    <div className={`reg-scope theme-${theme}`}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">CreditAI</div>

        <div className="nav-items">
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            type="button"
          >
            {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
          </button>

          <div className="user-profile">
            <span className="user-name">Dr. Amanda Rodriguez</span>
            <div className="avatar">AR</div>
          </div>

          {/* Optional: top-right logout */}
          {/* <button className="btn btn-secondary" onClick={handleLogout} type="button">Logout</button> */}
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <button
          className={`sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveView("dashboard")}
          type="button"
        >
          📊 Compliance Dashboard
        </button>
        <button
          className={`sidebar-item ${activeView === "audit" ? "active" : ""}`}
          onClick={() => setActiveView("audit")}
          type="button"
        >
          📋 Audit Trail
        </button>
        <button
          className={`sidebar-item ${activeView === "model" ? "active" : ""}`}
          onClick={() => setActiveView("model")}
          type="button"
        >
          🔍 Model Validation
        </button>
        <button
          className={`sidebar-item ${activeView === "reports" ? "active" : ""}`}
          onClick={() => setActiveView("reports")}
          type="button"
        >
          📈 Reports
        </button>
        <button
          className={`sidebar-item ${activeView === "fair" ? "active" : ""}`}
          onClick={() => setActiveView("fair")}
          type="button"
        >
          ⚖️ Fair Lending
        </button>
        <button
          className={`sidebar-item ${activeView === "settings" ? "active" : ""}`}
          onClick={() => setActiveView("settings")}
          type="button"
        >
          ⚙️ Settings
        </button>

        {/* ✅ Real logout */}
        <button className="sidebar-item" onClick={handleLogout} type="button">
          🚪 Logout
        </button>
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
                <button className="btn btn-primary" type="button">Generate Report</button>
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
                <button className="btn btn-secondary" type="button">Export Full Log</button>
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

        {/* REPORTS / FAIR LENDING / MODEL / SETTINGS */}
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
