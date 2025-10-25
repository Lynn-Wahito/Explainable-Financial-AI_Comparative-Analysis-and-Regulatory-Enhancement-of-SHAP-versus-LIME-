import React, { useState } from "react";
import "../../styles/admin.css";        // base + dark theme
import "../../styles/admin.light.css";   // light overrides

export default function AdminDashboard() {
  // Simple toggle: true = light, false = dark
  const [isLight, setIsLight] = useState(true);

  // change view: "dashboard" | "users" | "model"
  const [activeView, setActiveView] = useState("dashboard");

  return (
    <div className={`admin-scope ${isLight ? "theme-light" : "theme-dark"}`}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">CreditAI</div>

        <div className="nav-items">
          <a className="nav-link" href="#" onClick={(e) => e.preventDefault()}>Dashboard</a>
          <a className="nav-link" href="#" onClick={(e) => e.preventDefault()}>User Management</a>
          <a className="nav-link" href="#" onClick={(e) => e.preventDefault()}>System Config</a>
          <a className="nav-link" href="#" onClick={(e) => e.preventDefault()}>Model Training</a>

          <button
            className="theme-toggle"
            onClick={() => setIsLight((v) => !v)}
            title="Toggle Theme"
          >
            {isLight ? "☀️ Light" : "🌙 Dark"}
          </button>

          <div className="user-profile">
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              Dr. Marcus Chen
            </span>
            <div className="avatar">MC</div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        <button
          className={`sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveView("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          className={`sidebar-item ${activeView === "users" ? "active" : ""}`}
          onClick={() => setActiveView("users")}
        >
          👥 User Management
        </button>
        <button
          className={`sidebar-item ${activeView === "model" ? "active" : ""}`}
          onClick={() => setActiveView("model")}
        >
          🤖 Model Configuration
        </button>

        <button className="sidebar-item">📈 Analytics</button>
        <button className="sidebar-item">⚙️ System Settings</button>
        <button className="sidebar-item">🚪 Logout</button>
      </div>

      {/* MAIN */}
      <div className="main">
        {/* DASHBOARD VIEW */}
        {activeView === "dashboard" && (
          <>
            <div className="page-header">
              <h1 className="page-title">System Administration</h1>
              <p className="page-subtitle">
                Manage users, models, and system configuration
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: "#667eea" }}>24</div>
                <div className="stat-label">Active Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "#f59e0b" }}>5</div>
                <div className="stat-label">Pending Approvals</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "#10b981" }}>89.2%</div>
                <div className="stat-label">Model Accuracy</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "#667eea" }}>99.8%</div>
                <div className="stat-label">System Uptime</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
              {/* System Health */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">System Health</h3>
                </div>

                <div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>API Response Time</span>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>142ms</span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: "85%", height: "100%", background: "#10b981" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Database Performance</span>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>92%</span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: "92%", height: "100%", background: "#10b981" }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontWeight: 600 }}>Model Prediction Speed</span>
                      <span style={{ color: "#667eea", fontWeight: 700 }}>1.8s avg</span>
                    </div>
                    <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: "78%", height: "100%", background: "#667eea" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Quick Actions</h3>
                </div>

                <div>
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", marginBottom: 8 }}
                    onClick={() => setActiveView("users")}
                  >
                    Approve Pending Users
                  </button>
                  <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }}>
                    Retrain Model
                  </button>
                  <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }}>
                    Export System Report
                  </button>
                  <button className="btn btn-secondary" style={{ width: "100%" }}>
                    Backup Database
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* USER MANAGEMENT VIEW */}
        {activeView === "users" && (
          <>
            <div className="page-header">
              <h1 className="page-title">User Management</h1>
              <p className="page-subtitle">Approve users and assign roles</p>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Pending User Approvals</h3>
                <span className="badge badge-pending">5 Pending</span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Registered</th>
                    <th>Assign Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Emma Wilson</td>
                    <td>emma.wilson@email.com</td>
                    <td>Sep 21, 2024</td>
                    <td>
                      <select className="form-input" style={{ padding: "6px 12px", fontSize: ".875rem" }}>
                        <option>Select role...</option>
                        <option>Customer</option>
                        <option>Loan Officer</option>
                        <option>Analyst</option>
                        <option>Compliance Officer</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: ".75rem", marginRight: 4 }}>
                        Approve
                      </button>
                      <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: ".75rem" }}>
                        Reject
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>Robert Johnson</td>
                    <td>robert.j@email.com</td>
                    <td>Sep 21, 2024</td>
                    <td>
                      <select className="form-input" style={{ padding: "6px 12px", fontSize: ".875rem" }}>
                        <option>Select role...</option>
                        <option>Customer</option>
                        <option>Loan Officer</option>
                        <option>Analyst</option>
                        <option>Compliance Officer</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: ".75rem", marginRight: 4 }}>
                        Approve
                      </button>
                      <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: ".75rem" }}>
                        Reject
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Active Users</h3>
                <button className="btn btn-primary">Add New User</button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Active</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Sarah Chen</td>
                    <td>sarah.chen@company.com</td>
                    <td><span className="badge badge-review">Loan Officer</span></td>
                    <td><span className="badge badge-approved">Active</span></td>
                    <td>2 mins ago</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: ".75rem" }}>
                        Edit
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>Dr. Amanda Rodriguez</td>
                    <td>amanda.r@company.com</td>
                    <td><span className="badge badge-review">Compliance Officer</span></td>
                    <td><span className="badge badge-approved">Active</span></td>
                    <td>15 mins ago</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: ".75rem" }}>
                        Edit
                      </button>
                    </td>
                  </tr>

                  <tr>
                    <td>John Smith</td>
                    <td>john.smith@email.com</td>
                    <td><span className="badge badge-pending">Customer</span></td>
                    <td><span className="badge badge-approved">Active</span></td>
                    <td>1 hour ago</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: ".75rem" }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* MODEL CONFIG VIEW */}
        {activeView === "model" && (
          <>
            <div className="page-header">
              <h1 className="page-title">Model Configuration</h1>
              <p className="page-subtitle">XAI method selection and model settings</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
              {/* XAI Config */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">XAI Configuration</h3>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Explanation Method</label>
                  <select className="form-input">
                    <option defaultValue>SHAP (Recommended)</option>
                    <option>LIME</option>
                    <option>Both Methods</option>
                  </select>
                  <p style={{ fontSize: ".9rem", color: "var(--muted)", marginTop: 6 }}>
                    Based on research, SHAP provides higher consistency (8.7/10 vs 7.2/10)
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Risk Threshold</label>
                  <input type="range" className="form-input" min="0" max="1" step="0.01" defaultValue="0.7" />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", color: "var(--muted)", marginTop: 4 }}>
                    <span>Low (0.0)</span>
                    <span>Current: 0.7</span>
                    <span>High (1.0)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Model Retrain Frequency</label>
                  <select className="form-input">
                    <option>Daily</option>
                    <option defaultValue>Weekly</option>
                    <option>Monthly</option>
                    <option>Manual Only</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Explanation Verbosity</label>
                  <select className="form-input">
                    <option>Minimal (Top 3 features)</option>
                    <option defaultValue>Standard (Top 5 features)</option>
                    <option>Detailed (All features)</option>
                  </select>
                </div>

                <button className="btn btn-primary">Save Configuration</button>
              </div>

              {/* Current Model */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Current Model</h3>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: ".95rem", color: "var(--muted)", marginBottom: 4 }}>Model Type</div>
                  <div style={{ fontWeight: 700 }}>XGBoost v2.1.3</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: ".95rem", color: "var(--muted)", marginBottom: 4 }}>Last Trained</div>
                  <div style={{ fontWeight: 700 }}>Sep 15, 2024</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: ".95rem", color: "var(--muted)", marginBottom: 4 }}>Training Dataset</div>
                  <div style={{ fontWeight: 700 }}>UCI Credit Card (30,000 records)</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: ".95rem", color: "var(--muted)", marginBottom: 4 }}>Accuracy</div>
                  <div style={{ fontWeight: 700, color: "#10b981" }}>89.2%</div>
                </div>

                <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }}>
                  Retrain Model
                </button>
                <button className="btn btn-secondary" style={{ width: "100%" }}>
                  Export Model
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">SHAP vs LIME Performance Comparison</h3>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Avg Processing Time</th>
                    <th>Consistency Score</th>
                    <th>Clarity Rating</th>
                    <th>User Satisfaction</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "rgba(16,185,129,.08)" }}>
                    <td><strong>SHAP</strong></td>
                    <td>2.3s</td>
                    <td style={{ color: "#10b981", fontWeight: 700 }}>8.7/10</td>
                    <td>7.9/10</td>
                    <td>85%</td>
                    <td><span className="badge badge-approved">Recommended</span></td>
                  </tr>
                  <tr>
                    <td><strong>LIME</strong></td>
                    <td>1.8s</td>
                    <td>7.2/10</td>
                    <td style={{ color: "#10b981", fontWeight: 700 }}>8.8/10</td>
                    <td>78%</td>
                    <td><span className="badge badge-pending">Alternative</span></td>
                  </tr>
                </tbody>
              </table>

              <div
                style={{
                  background: "rgba(16,185,129,.08)",
                  border: "1px solid rgba(16,185,129,.25)",
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 20,
                }}
              >
                <h4 style={{ color: "#16a34a", marginBottom: 8 }}>💡 Research Recommendation</h4>
                <p style={{ color: "#16a34a", fontSize: ".95rem", margin: 0 }}>
                  Based on comparative analysis of 6,000 test cases, <strong>SHAP is recommended</strong> as the primary explanation method due to higher consistency scores (8.7 vs 7.2), better feature stability (87% vs 72%), and stronger alignment with regulatory requirements. LIME can be used as a supplementary method for cases requiring enhanced clarity for non-technical stakeholders.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
