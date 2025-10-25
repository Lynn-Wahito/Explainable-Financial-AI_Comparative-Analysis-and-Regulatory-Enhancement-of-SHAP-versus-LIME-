// src/pages/customer/CustomerDashboard.jsx
import React, { useState } from "react";
import "../../styles/customer.css";

export default function CustomerDashboard() {
  const [theme, setTheme] = useState("dark"); // "dark" | "light"
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "apply" | "applications" | "status"

  // ✅ Added state to hold the selected application
  const [selectedApp, setSelectedApp] = useState(null);

  // ✅ Added handler to open Status view with the selected app
  const viewApplication = (app) => {
    setSelectedApp(app);
    setActiveView("status");
  };

  // ---- Mock data (visible on first render)
  const mockApps = [
    {
      id: "#LN-2024-003",
      amount: "$45,000",
      purpose: "Personal",
      status: "Under Review",
      statusType: "pending",
      submitted: "Sep 20, 2024",
    },
    {
      id: "#LN-2024-001",
      amount: "$30,000",
      purpose: "Home Improvement",
      status: "Approved",
      statusType: "approved",
      submitted: "Aug 15, 2024",
    },
  ];

  return (
    <div className={`customer-scope theme-${theme}`}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">CreditAI</div>
        <div className="nav-items">
          <a className="nav-link" href="#">My Applications</a>
          <a className="nav-link" href="#" onClick={(e)=>{e.preventDefault(); setActiveView("apply");}}>
            Apply for Loan
          </a>
          <a className="nav-link" href="#">Help</a>

          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
          </button>

          <div className="user-profile">
            <span className="user-name">John Smith</span>
            <div className="avatar">JS</div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <button
          className={`sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveView("dashboard")}
        >
          📊 Dashboard
        </button>

        <button
          className={`sidebar-item ${activeView === "apply" ? "active" : ""}`}
          onClick={() => setActiveView("apply")}
        >
          ➕ New Application
        </button>

        <button
          className={`sidebar-item ${activeView === "applications" ? "active" : ""}`}
          onClick={() => setActiveView("applications")}
        >
          📁 My Applications
        </button>

        <button className="sidebar-item">👤 Profile</button>
        <button className="sidebar-item">⚙️ Settings</button>
        <button className="sidebar-item">🚪 Logout</button>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* DASHBOARD (Full-width content) */}
        {activeView === "dashboard" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Welcome back, John!</h1>
              <p className="page-subtitle">
                Track your loan applications and manage your account
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--warning)" }}>1</div>
                <div className="stat-label">Pending Applications</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--accent)" }}>2</div>
                <div className="stat-label">Approved Loans</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--primary)" }}>$75,000</div>
                <div className="stat-label">Total Credit Limit</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Applications</h3>
                <button className="btn btn-primary" onClick={() => setActiveView("apply")}>
                  Apply for New Loan
                </button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Loan Amount</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mockApps.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.amount}</td>
                      <td>{a.purpose}</td>
                      <td>
                        <span
                          className={`badge ${
                            a.statusType === "approved"
                              ? "badge-approved"
                              : a.statusType === "pending"
                              ? "badge-pending"
                              : "badge-review"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td>{a.submitted}</td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => viewApplication(a)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* APPLY (FULL SCREEN, not centered) */}
        {activeView === "apply" && (
          <div className="content full">
            <div className="page-header">
              <h1 className="page-title">Apply for a Loan</h1>
              <p className="page-subtitle">Fill out the application form below</p>
            </div>

            <div className="card apply-card">
              <form className="apply-form">
                <h3 className="section-title">Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" defaultValue="John Smith" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" defaultValue="john.smith@email.com" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" placeholder="+1 (555) 123-4567" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input className="form-input" type="date" required />
                  </div>
                </div>

                <h3 className="section-title">Loan Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Loan Amount ($)</label>
                    <input className="form-input" type="number" placeholder="45000" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Loan Purpose</label>
                    <select className="form-input" required>
                      <option>Select purpose...</option>
                      <option>Personal</option>
                      <option>Home Improvement</option>
                      <option>Debt Consolidation</option>
                      <option>Medical</option>
                      <option>Education</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preferred Term (months)</label>
                    <select className="form-input" required>
                      <option>36 months</option>
                      <option>48 months</option>
                      <option>60 months</option>
                    </select>
                  </div>
                </div>

                <h3 className="section-title">Financial Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Annual Income ($)</label>
                    <input className="form-input" type="number" placeholder="78000" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select className="form-input" required>
                      <option>Full-time Employed</option>
                      <option>Part-time Employed</option>
                      <option>Self-employed</option>
                      <option>Unemployed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Housing Payment ($)</label>
                    <input className="form-input" type="number" placeholder="1500" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Other Monthly Debt ($)</label>
                    <input className="form-input" type="number" placeholder="800" required />
                  </div>
                </div>

                <div className="actions">
                  <button type="submit" className="btn btn-primary">Submit Application</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveView("dashboard")}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* APPLICATIONS LIST (Full width) */}
        {activeView === "applications" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">My Applications</h1>
              <p className="page-subtitle">Overview of your submitted applications</p>
            </div>

            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Loan Amount</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mockApps.map((a) => (
                    <tr key={`list-${a.id}`}>
                      <td>{a.id}</td>
                      <td>{a.amount}</td>
                      <td>{a.purpose}</td>
                      <td>
                        <span
                          className={`badge ${
                            a.statusType === "approved"
                              ? "badge-approved"
                              : a.statusType === "pending"
                              ? "badge-pending"
                              : "badge-review"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td>{a.submitted}</td>
                      <td>
                        <button className="btn btn-secondary" onClick={() => viewApplication(a)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATUS VIEW */}
        {activeView === "status" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Application Status</h1>
              <p className="page-subtitle">
                {selectedApp ? `${selectedApp.id}` : "No application selected"}
              </p>
            </div>

            {selectedApp && (
              <>
                <div className="card">
                  {/* Simple timeline mock */}
                  <div style={{ display: "flex", gap: 24, padding: 8, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div className="badge badge-approved" style={{ display: "inline-block" }}>✓</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Submitted</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{selectedApp.submitted}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="badge badge-review" style={{ display: "inline-block" }}>✓</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>AI Analysis</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Completed</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className={`badge ${selectedApp.statusType === "pending" ? "badge-pending" : "badge-approved"}`} style={{ display: "inline-block" }}>
                        {selectedApp.statusType === "pending" ? "3" : "✓"}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Officer Review</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {selectedApp.statusType === "pending" ? "In Progress" : "Complete"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="badge badge-pending" style={{ display: "inline-block" }}>4</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Decision</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Pending</div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title">Application Details</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Loan Amount</div>
                        <div className="strong">{selectedApp.amount}</div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Purpose</div>
                        <div className="strong">{selectedApp.purpose}</div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Term</div>
                        <div className="strong">36 months</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Current Status</div>
                        <span
                          className={`badge ${
                            selectedApp.statusType === "approved"
                              ? "badge-approved"
                              : selectedApp.statusType === "pending"
                              ? "badge-pending"
                              : "badge-review"
                          }`}
                        >
                          {selectedApp.status}
                        </span>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Estimated Decision</div>
                        <div className="strong">Within 2–3 business days</div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Reference Number</div>
                        <div className="strong" style={{ fontFamily: "monospace" }}>{selectedApp.id}</div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "var(--info-soft)",
                      border: "1px solid var(--info-border)",
                      padding: 16,
                      borderRadius: 8,
                      marginTop: 24,
                      color: "var(--info-strong)",
                      fontSize: 14,
                    }}
                  >
                    <strong>What's happening now?</strong> Our AI system has analyzed your application and a
                    loan officer is currently reviewing the results. You will receive an email notification
                    as soon as a decision is made.
                  </div>

                  <button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => setActiveView("dashboard")}>
                    Back to Dashboard
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
