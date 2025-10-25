import React, { useState } from "react";
import "../../styles/admin.css";
import "../../styles/admin.light.css";

export default function AdminDashboard() {
  const [view, setView] = useState("dashboard"); // dashboard | users | model
  const [theme, setTheme] = useState("light");   // light | dark

  return (
    <div className={`admin-root ${theme === "light" ? "theme-light" : ""}`}>
      {/* ===== Navbar ===== */}
      <div className="navbar">
        <div className="logo">CreditAI</div>
        <div className="nav-items">
          <a className="nav-link" href="#">Dashboard</a>
          <a className="nav-link" href="#">User Management</a>
          <a className="nav-link" href="#">System Config</a>
          <a className="nav-link" href="#">Model Training</a>

          {/* Theme toggle */}
          <button
            className="btn btn-secondary"
            style={{ marginLeft: "12px" }}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>

          <div className="user-profile">
            <span
              style={{
                fontWeight: 500,
                color: theme === "light" ? "#111827" : "#e5e7eb",
              }}
            >
              Dr. Marcus Chen
            </span>
            <div className="avatar">MC</div>
          </div>
        </div>
      </div>

      {/* ===== Shell ===== */}
      <div className="admin-shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div
            className={`sidebar-item ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            📊 Dashboard
          </div>
          <div
            className={`sidebar-item ${view === "users" ? "active" : ""}`}
            onClick={() => setView("users")}
          >
            👥 User Management
          </div>
          <div
            className={`sidebar-item ${view === "model" ? "active" : ""}`}
            onClick={() => setView("model")}
          >
            🤖 Model Configuration
          </div>
          <div className="sidebar-item">📈 Analytics</div>
          <div className="sidebar-item">⚙️ System Settings</div>
          <div className="sidebar-item">🚪 Logout</div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="content-inner">
            {/* === DASHBOARD VIEW === */}
            {view === "dashboard" && (
              <>
                <div className="page-header">
                  <h1 className="page-title">System Administration</h1>
                  <p className="page-subtitle">
                    Manage users, models, and system configuration
                  </p>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: "#6366f1" }}>24</div>
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
                    <div className="stat-value" style={{ color: "#6366f1" }}>99.8%</div>
                    <div className="stat-label">System Uptime</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">System Health</h3>
                    </div>
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>API Response Time</span>
                          <span style={{ color: "#10b981", fontWeight: 700 }}>142 ms</span>
                        </div>
                        <div style={{ height: 8, background: "#1e293b", borderRadius: 4 }}>
                          <div style={{ width: "85%", height: "100%", background: "#10b981" }} />
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>Database Performance</span>
                          <span style={{ color: "#10b981", fontWeight: 700 }}>92 %</span>
                        </div>
                        <div style={{ height: 8, background: "#1e293b", borderRadius: 4 }}>
                          <div style={{ width: "92%", height: "100%", background: "#10b981" }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 600 }}>Model Prediction Speed</span>
                          <span style={{ color: "#6366f1", fontWeight: 700 }}>1.8 s avg</span>
                        </div>
                        <div style={{ height: 8, background: "#1e293b", borderRadius: 4 }}>
                          <div style={{ width: "78%", height: "100%", background: "#6366f1" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Quick Actions</h3>
                    </div>
                    <div>
                      <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={() => setView("users")}>
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

            {/* === USERS VIEW === */}
            {view === "users" && (
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

                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th><th>Email</th><th>Registered</th><th>Assign Role</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Emma Wilson</td><td>emma.wilson@email.com</td><td>Sep 21 2024</td>
                          <td>
                            <select className="form-input" style={{ padding: "6px 12px", fontSize: ".875rem" }}>
                              <option>Select role…</option>
                              <option>Customer</option><option>Loan Officer</option>
                              <option>Analyst</option><option>Compliance Officer</option>
                            </select>
                          </td>
                          <td>
                            <button className="btn btn-success" style={{ padding: "6px 12px", fontSize: ".75rem", marginRight: 4 }}>Approve</button>
                            <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: ".75rem" }}>Reject</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Active Users</h3>
                    <button className="btn btn-primary">Add New User</button>
                  </div>

                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Active</th><th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Sarah Chen</td><td>sarah.chen@company.com</td>
                          <td><span className="badge badge-review">Loan Officer</span></td>
                          <td><span className="badge badge-approved">Active</span></td>
                          <td>2 mins ago</td>
                          <td><button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: ".75rem" }}>Edit</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* === MODEL VIEW === */}
            {view === "model" && (
              <>
                <div className="page-header">
                  <h1 className="page-title">Model Configuration</h1>
                  <p className="page-subtitle">XAI method selection and model settings</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">XAI Configuration</h3>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Primary Explanation Method</label>
                      <select className="form-input">
                        <option>SHAP (Recommended)</option><option>LIME</option><option>Both Methods</option>
                      </select>
                      <p style={{ fontSize: ".8rem", color: "#94a3b8", marginTop: 6 }}>
                        Based on research, SHAP provides higher consistency (8.7 / 10 vs 7.2 / 10)
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Risk Threshold</label>
                      <input type="range" className="form-input" min="0" max="1" step="0.01" defaultValue="0.7" />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", color: "#94a3b8", marginTop: 4 }}>
                        <span>Low (0.0)</span><span>Current: 0.7</span><span>High (1.0)</span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Model Retrain Frequency</label>
                      <select className="form-input">
                        <option>Daily</option><option selected>Weekly</option><option>Monthly</option><option>Manual Only</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Explanation Verbosity</label>
                      <select className="form-input">
                        <option>Minimal (Top 3 features)</option>
                        <option selected>Standard (Top 5 features)</option>
                        <option>Detailed (All features)</option>
                      </select>
                    </div>

                    <button className="btn btn-primary">Save Configuration</button>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Current Model</h3>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: ".9rem", color: "#94a3b8", marginBottom: 4 }}>Model Type</div>
                      <div style={{ fontWeight: 700 }}>XGBoost v2.1.3</div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: ".9rem", color: "#94a3b8", marginBottom: 4 }}>Last Trained</div>
                      <div style={{ fontWeight: 700 }}>Sep 15 2024</div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: ".9rem", color: "#94a3b8", marginBottom: 4 }}>Training Dataset</div>
                      <div style={{ fontWeight: 700 }}>UCI Credit Card (30,000 records)</div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: ".9rem", color: "#94a3b8", marginBottom: 4 }}>Accuracy</div>
                      <div style={{ fontWeight: 700, color: "#10b981" }}>89.2 %</div>
                    </div>
                    <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }}>Retrain Model</button>
                    <button className="btn btn-secondary" style={{ width: "100%" }}>Export Model</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
