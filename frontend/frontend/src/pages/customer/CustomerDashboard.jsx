// src/pages/customer/CustomerDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/customer.css";

const API_BASE = "http://127.0.0.1:8000";

function badgeFor(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("approve")) return "badge-approved";
  if (s.includes("pend")) return "badge-pending";
  return "badge-review";
}

export default function CustomerDashboard() {
  const nav = useNavigate();
  const [theme, setTheme] = useState("dark");
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "apply" | "applications" | "status"
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, totalLimit: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);

  const token = localStorage.getItem("access_token");

  // ---- shared auth error handler
  const handleAuthFail = (res) => {
    if ([401, 403, 404].includes(res.status)) {
      localStorage.removeItem("access_token");
      nav("/login");
      return true;
    }
    return false;
  };

  // ---- API helpers
  async function fetchApplications() {
    const res = await fetch(`${API_BASE}/customer/applications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleAuthFail(res)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load applications");

    const normalized = (data || []).map((a, i) => ({
      id: a.id ?? a.app_id ?? `APP-${i + 1}`,
      amount: a.amount,
      purpose: a.purpose || a.loan_purpose || "—",
      status: a.status || a.decision || "Pending",
      submitted:
        a.submitted_at
          ? new Date(a.submitted_at).toLocaleString()
          : a.created_at
          ? new Date(a.created_at).toLocaleString()
          : "—",
    }));
    setApplications(normalized);
  }

  async function fetchDashboard() {
    const res = await fetch(`${API_BASE}/customer/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (handleAuthFail(res)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to fetch dashboard");

    setProfile(data.profile || { name: "Customer" });

    if (Array.isArray(data.applications)) {
      const normalized = (data.applications || []).map((a, i) => ({
        id: a.id ?? a.app_id ?? `APP-${i + 1}`,
        amount: a.amount,
        purpose: a.purpose || a.loan_purpose || "—",
        status: a.status || a.decision || "Pending",
        submitted:
          a.submitted_at
            ? new Date(a.submitted_at).toLocaleString()
            : a.created_at
            ? new Date(a.created_at).toLocaleString()
            : "—",
      }));
      setApplications(normalized);
    }

    const pending = data.credit?.pending_count ?? data.metrics?.pending ?? 0;
    const approved = data.credit?.approved_count ?? data.metrics?.approved ?? 0;
    const totalLimit = data.credit?.total_limit ?? data.metrics?.total_limit ?? 0;
    setStats({ pending, approved, totalLimit });
  }

  // ---- Initial load + light refresh on tab change back to dashboard
  useEffect(() => {
    (async () => {
      try {
        if (!token) {
          nav("/login");
          return;
        }
        setLoading(true);
        await fetchDashboard();
        if (!applications.length) {
          await fetchApplications();
        }
      } catch (err) {
        console.error(err);
        // No alert popups; keep UX clean
      } finally {
        setLoading(false);
      }
    })();
    // refresh when user returns to dashboard tab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // ---- View details
  function viewApplication(app) {
    setSelectedApp(app);
    setActiveView("status");
  }

  // ---- Submit new loan
  async function submitApplication(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      amount: parseFloat(form.amount.value),
      purpose: form.purpose.value,
      term_months: parseInt(form.term.value, 10),
      income: parseFloat(form.income.value),
      employment_status: form.employment.value,
      housing_payment: parseFloat(form.housing.value),
      other_debt: parseFloat(form.debt.value),
    };

    try {
      const res = await fetch(`${API_BASE}/customer/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (handleAuthFail(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Application failed");

      // Soft toast via console to avoid blocking alerts
      console.log("✅ Loan application submitted successfully!");
      await fetchApplications();
      setActiveView("dashboard");
    } catch (err) {
      console.error("❌ ", err.message);
    }
  }

  // ---- Logout
  function handleLogout() {
    localStorage.removeItem("access_token");
    nav("/login");
  }

  if (loading) return <div className="customer-scope">Loading dashboard…</div>;

  return (
    <div className={`customer-scope theme-${theme}`}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">CreditAI</div>
        <div className="nav-items">
          <a
            className="nav-link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveView("applications");
            }}
          >
            My Applications
          </a>
          <a
            className="nav-link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveView("apply");
            }}
          >
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
            <span className="user-name">{profile?.name || "Customer"}</span>
            <div className="avatar">
              {(profile?.name || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
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
        <button className="sidebar-item" onClick={handleLogout}>
          🚪 Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="main">
        {/* DASHBOARD */}
        {activeView === "dashboard" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">
                Welcome back, {(profile?.name || "Customer").split(" ")[0]}!
              </h1>
              <p className="page-subtitle">
                Track your loan applications and manage your account
              </p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--warning)" }}>
                  {stats.pending}
                </div>
                <div className="stat-label">Pending Applications</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--accent)" }}>
                  {stats.approved}
                </div>
                <div className="stat-label">Approved Loans</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--primary)" }}>
                  Ksh {Number(stats.totalLimit || 0).toLocaleString()}
                </div>
                <div className="stat-label">Total Credit Limit</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Applications</h3>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveView("apply")}
                >
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
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                        No applications yet.
                      </td>
                    </tr>
                  ) : (
                    applications.slice(0, 3).map((a, i) => (
                      <tr key={a.id || i}>
                        <td>{a.id}</td>
                        <td>Ksh {Number(a.amount || 0).toLocaleString()}</td>
                        <td>{a.purpose}</td>
                        <td>
                          <span className={`badge ${badgeFor(a.status)}`}>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* APPLY */}
        {activeView === "apply" && (
          <div className="content full">
            <div className="page-header">
              <h1 className="page-title">Apply for a Loan</h1>
              <p className="page-subtitle">Fill out the application form below</p>
            </div>

            <div className="card apply-card">
              <form className="apply-form" onSubmit={submitApplication}>
                <h3 className="section-title">Loan Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Loan Amount (Ksh)</label>
                    <input className="form-input" name="amount" type="number" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Loan Purpose</label>
                    <select className="form-input" name="purpose" required>
                      <option value="">Select purpose...</option>
                      <option>Personal</option>
                      <option>Home Improvement</option>
                      <option>Education</option>
                      <option>Medical</option>
                      <option>Business</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Term (months)</label>
                    <select className="form-input" name="term" required>
                      <option>36</option>
                      <option>48</option>
                      <option>60</option>
                    </select>
                  </div>
                </div>

                <h3 className="section-title">Financial Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Annual Income (Ksh)</label>
                    <input className="form-input" name="income" type="number" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select className="form-input" name="employment" required>
                      <option>Full-time Employed</option>
                      <option>Part-time Employed</option>
                      <option>Self-employed</option>
                      <option>Unemployed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Monthly Housing Payment (Ksh)</label>
                    <input className="form-input" name="housing" type="number" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Other Monthly Debt (Ksh)</label>
                    <input className="form-input" name="debt" type="number" required />
                  </div>
                </div>

                <div className="actions">
                  <button type="submit" className="btn btn-primary">Submit Application</button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveView("dashboard")}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MY APPLICATIONS */}
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
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                        You haven’t submitted any applications yet.
                      </td>
                    </tr>
                  ) : (
                    applications.map((a, i) => (
                      <tr key={`list-${a.id || i}`}>
                        <td>{a.id}</td>
                        <td>Ksh {Number(a.amount || 0).toLocaleString()}</td>
                        <td>{a.purpose}</td>
                        <td>
                          <span className={`badge ${badgeFor(a.status)}`}>{a.status}</span>
                        </td>
                        <td>{a.submitted}</td>
                        <td>
                          <button className="btn btn-secondary" onClick={() => viewApplication(a)}>
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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
                      <div className={`badge ${badgeFor(selectedApp.status)}`} style={{ display: "inline-block" }}>
                        {selectedApp.status.toLowerCase().includes("pend") ? "…" : "✓"}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Officer Review</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {selectedApp.status.toLowerCase().includes("pend") ? "In Progress" : "Complete"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div className="badge badge-pending" style={{ display: "inline-block" }}>•</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Decision</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {selectedApp.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title">Application Details</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Loan Amount</div>
                        <div className="strong">Ksh {Number(selectedApp.amount || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Purpose</div>
                        <div className="strong">{selectedApp.purpose}</div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Term</div>
                        <div className="strong">—</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Current Status</div>
                        <span className={`badge ${badgeFor(selectedApp.status)}`}>{selectedApp.status}</span>
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

