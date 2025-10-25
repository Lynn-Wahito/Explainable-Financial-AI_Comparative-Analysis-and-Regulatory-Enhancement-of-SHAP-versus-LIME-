// src/pages/analyst/AnalystDashboard.jsx
import React, { useState } from "react";
import "../../styles/analyst.css";

export default function AnalystDashboard() {
  const [theme, setTheme] = useState("light"); // "light" | "dark"
  const [view, setView] = useState("dashboard"); // "dashboard" | "review"

  const mockPriority = [
    { id: "#LN-2024-003", name: "John Smith", amount: "$45,000", risk: 0.78, conf: "94.2%", status: "Review Required" },
    { id: "#LN-2024-004", name: "Maria Garcia", amount: "$32,000", risk: 0.24, conf: "96.8%", status: "In Review" },
    { id: "#LN-2024-005", name: "David Lee",  amount: "$28,000", risk: 0.52, conf: "88.5%", status: "Pending" }
  ];

  return (
    <div className={`analyst-scope theme-${theme}`}>
      {/* NAVBAR */}
      <div className="an-navbar">
        <div className="an-logo">CreditAI</div>
        <div className="an-nav-items">
          <button className="an-nav-link" onClick={() => setView("dashboard")}>Dashboard</button>
          <button className="an-nav-link">Applications</button>
          <button className="an-nav-link">Reports</button>

          <button
            className="an-theme-toggle"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "🌙 Dark" : "🌞 Light"}
          </button>

          <div className="an-user-profile">
            <span className="an-user-name">Sarah Chen</span>
            <div className="an-avatar">SC</div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="an-sidebar">
        <button
          className={`an-sidebar-item ${view === "dashboard" ? "active" : ""}`}
          onClick={() => setView("dashboard")}
        >
          📊 Dashboard
        </button>
        <button className="an-sidebar-item">📋 Applications Queue</button>
        <button className="an-sidebar-item">🤖 AI Analysis</button>
        <button className="an-sidebar-item">📈 Reports</button>
        <button className="an-sidebar-item">⚙️ Settings</button>
        <button className="an-sidebar-item">🚪 Logout</button>
      </aside>

      {/* MAIN */}
      <main className="an-main">
        {view === "dashboard" && (
          <div className="an-content">
            <div className="an-page-header">
              <h1 className="an-page-title">Loan Officer Dashboard</h1>
              <p className="an-page-subtitle">Review and process loan applications</p>
            </div>

            <div className="an-stats-grid">
              <div className="an-stat-card">
                <div className="an-stat-value an-warn">47</div>
                <div className="an-stat-label">Pending Reviews</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-value an-good">156</div>
                <div className="an-stat-label">Approved Today</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-value an-bad">23</div>
                <div className="an-stat-label">High Risk Apps</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-value an-accent">89%</div>
                <div className="an-stat-label">Model Accuracy</div>
              </div>
            </div>

            <div className="an-card">
              <div className="an-card-header">
                <h3 className="an-card-title">Priority Applications</h3>
                <button className="an-btn an-btn-primary">View All Applications</button>
              </div>

              <table className="an-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Customer Name</th>
                    <th>Amount</th>
                    <th>AI Risk Score</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mockPriority.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.name}</td>
                      <td>{row.amount}</td>
                      <td style={{ fontWeight: 700, color: row.risk >= 0.6 ? "var(--an-danger)" : "var(--an-good)" }}>
                        {row.risk.toFixed(2)}
                      </td>
                      <td>{row.conf}</td>
                      <td>
                        <span className={`an-badge ${
                          row.status.includes("Review") ? "an-badge-pending"
                          : row.status.includes("In Review") ? "an-badge-review"
                          : "an-badge-neutral"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <button className="an-btn an-btn-primary" onClick={() => setView("review")}>
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="an-card">
                <div className="an-card-header">
                    <h3 className="an-card-title">Recent Decisions</h3>
                </div>

                <div className="an-kpi-row">
                    <div className="an-kpi kpi-approved">
                    <div className="kpi-label">Approved</div>
                    <div className="kpi-value">34</div>
                    <div className="kpi-sub">Last 24 hours</div>
                    </div>

                    <div className="an-kpi kpi-declined">
                    <div className="kpi-label">Declined</div>
                    <div className="kpi-value">12</div>
                    <div className="kpi-sub">Last 24 hours</div>
                    </div>

                    <div className="an-kpi kpi-pending">
                    <div className="kpi-label">Pending</div>
                    <div className="kpi-value">47</div>
                    <div className="kpi-sub">Awaiting review</div>
                    </div>
                </div>
             </div>
          </div>
        )}

        {/* REVIEW / ANALYZE (SHAP vs LIME) */}
        {view === "review" && (
          <div className="an-content">
            <div className="an-page-header">
              <h1 className="an-page-title">Application Analysis: #LN-2024-003</h1>
              <p className="an-page-subtitle">John Smith — $45,000 Personal Loan</p>
            </div>

            <div className="an-card">
              <div className="an-risk-banner">
                <div className="score">0.78</div>
                <div className="level">HIGH RISK</div>
                <div className="meta">Model Confidence: 94.2% | XGBoost v2.1</div>
              </div>

              <h3 className="an-section-title">AI Explanation Comparison</h3>

              <div className="an-two-col">
                {/* SHAP */}
                <div className="an-expl shap">
                  <div className="head">
                    <h4>SHAP Analysis</h4>
                    <span className="chip blue">Score: 8.7/10</span>
                  </div>
                  <div className="placeholder">SHAP Waterfall Chart</div>
                  <ul className="pairs">
                    <li className="neg"><span>Payment History</span><b>+0.32</b></li>
                    <li className="neg"><span>Debt-to-Income</span><b>+0.28</b></li>
                    <li className="pos"><span>Credit Limit</span><b>-0.15</b></li>
                    <li className="pos"><span>Employment</span><b>-0.08</b></li>
                  </ul>
                  <div className="meta-box">
                    <b>Processing Time:</b> 2.3s<br />
                    <b>Consistency:</b> High (87%)
                  </div>
                </div>

                {/* LIME */}
                <div className="an-expl lime">
                  <div className="head">
                    <h4>LIME Analysis</h4>
                    <span className="chip green">Score: 7.2/10</span>
                  </div>
                  <div className="placeholder">LIME Local Explanation</div>
                  <ul className="pairs">
                    <li className="neg"><span>Debt-to-Income</span><b>+0.35</b></li>
                    <li className="neg"><span>Payment History</span><b>+0.29</b></li>
                    <li className="pos"><span>Age Factor</span><b>-0.12</b></li>
                    <li className="pos"><span>Credit Limit</span><b>-0.11</b></li>
                  </ul>
                  <div className="meta-box">
                    <b>Processing Time:</b> 1.8s<br />
                    <b>Consistency:</b> Medium (72%)
                  </div>
                </div>
              </div>

              <div className="an-card soft">
                <h4>Comparison Summary</h4>
                <table className="an-table">
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
                      <td className="win">SHAP</td>
                    </tr>
                    <tr>
                      <td>Processing Speed</td>
                      <td>2.3s</td>
                      <td>1.8s</td>
                      <td className="win">LIME</td>
                    </tr>
                    <tr>
                      <td>Feature Agreement</td>
                      <td colSpan={2} style={{ textAlign: "center" }}>
                        73% (Both identify payment history & DTI as top factors)
                      </td>
                      <td>Good</td>
                    </tr>
                  </tbody>
                </table>

                <p> </p>

                <div className="an-actions center">
                  <button className="an-btn an-btn-primary">Proceed with SHAP Analysis</button>
                  <button className="an-btn">Use LIME Analysis</button>
                  <button className="an-btn">Request Manual Review</button>
                  <button className="an-btn" onClick={() => setView("dashboard")}>← Back</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
