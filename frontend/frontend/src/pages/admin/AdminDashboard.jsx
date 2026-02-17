import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin.css";
import "../../styles/admin.light.css";

const API_BASE = "http://127.0.0.1:8000";

function formatDuration(ms) {
  if (!ms || ms < 0) return "-";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export default function AdminDashboard() {
  const [isLight, setIsLight] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");

  // ===== NEW: dashboard metrics =====
  const [metrics, setMetrics] = useState({
    total_users: 0,
    active_users: 0,
    pending_users: 0,
    last_registered_email: null,
    last_registered_at: null,
    started_at: null,
    server_time: null,
  });
  const [apiLatencyMs, setApiLatencyMs] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);

  // ===== existing: users management state =====
  const [pending, setPending] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleChoice, setRoleChoice] = useState({}); // { [userId]: "customer" }

  const token = localStorage.getItem("access_token");
  const authHeader = useMemo(
    () =>
      token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : { "Content-Type": "application/json" },
    [token]
  );

  // ---------- Dashboard fetchers ----------
  async function fetchMetrics() {
    const res = await fetch(`${API_BASE}/admin/metrics`, {
      headers: authHeader,
    });
    if (!res.ok) throw new Error("Failed to load metrics");
    const json = await res.json();
    setMetrics(json);
  }

  async function fetchModelInfo() {
    const res = await fetch(`${API_BASE}/ml/info`);
    if (res.ok) {
      const json = await res.json();
      setModelInfo(json);
    } else {
      setModelInfo(null);
    }
  }

  async function measureLatency() {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/ml/health`);
    const t1 = performance.now();
    if (res.ok) setApiLatencyMs(Math.round(t1 - t0));
  }

  useEffect(() => {
    if (activeView === "dashboard") {
      Promise.allSettled([fetchMetrics(), fetchModelInfo(), measureLatency()]);
    }
  }, [activeView]);

  // ---------- Users fetchers ----------
  async function fetchUsers() {
    try {
      setLoadingUsers(true);
      const p = await fetch(`${API_BASE}/admin/users?status=pending`, {
        headers: authHeader,
      });
      const pJson = await p.json();

      const a = await fetch(`${API_BASE}/admin/users?status=active`, {
        headers: authHeader,
      });
      const aJson = await a.json();

      setPending(Array.isArray(pJson) ? pJson : []);
      setActiveUsers(Array.isArray(aJson) ? aJson : []);
    } catch (e) {
      alert("Failed to load users. Are you logged in as Admin?");
    } finally {
      setLoadingUsers(false);
    }
  }
  useEffect(() => {
    if (activeView === "users") fetchUsers();
  }, [activeView]);

  async function approveUser(user) {
    const selectedRole = roleChoice[user.id];
    if (!selectedRole) return alert("Select a role before approving.");
    try {
      const res = await fetch(`${API_BASE}/admin/assign-role`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ email: user.email, role: selectedRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to assign role");
      }
      await Promise.all([fetchUsers(), fetchMetrics()]);
    } catch (e) {
      alert(e.message);
    }
  }

  async function deactivateUser(user) {
    try {
      const res = await fetch(
        `${API_BASE}/admin/deactivate?email=${encodeURIComponent(user.email)}`,
        { method: "POST", headers: authHeader }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to deactivate");
      }
      await Promise.all([fetchUsers(), fetchMetrics()]);
    } catch (e) {
      alert(e.message);
    }
  }

  const uptimeMs =
    metrics.started_at && metrics.server_time
      ? new Date(metrics.server_time).getTime() -
        new Date(metrics.started_at).getTime()
      : null;

  const latencyPct = apiLatencyMs
    ? Math.max(5, Math.min(100, Math.round(((800 - apiLatencyMs) / 800) * 100)))
    : 50;

  const nav = useNavigate();

    function handleLogout() {
      try {
        // clear anything you stored on login
        localStorage.removeItem("access_token");
        localStorage.removeItem("role");
        localStorage.removeItem("email");
        localStorage.removeItem("expires_at"); // if you set this anywhere
      } finally {
        // optional: reset local state
        setActiveView("dashboard");
        // go to login
        nav("/login", { replace: true });
      }
    }

  return (
    <div className={`admin-scope ${isLight ? "theme-light" : "theme-dark"}`}>
      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">CreditAI</div>

        <div className="nav-items">
        <button
          className="theme-toggle"
          onClick={() => setIsLight((v) => !v)}
          title="Toggle Theme"
        >
          {isLight ? "☀️ Light" : "🌙 Dark"}
        </button>

        <div className="user-profile">
          <span style={{ fontWeight: 600, color: "var(--text)" }}>Admin</span>
          <div className="avatar">AD</div>
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
      <button className="sidebar-item" onClick={handleLogout}>🚪 Logout</button>
    </div>

    {/* MAIN */}
    <div className="main">
      {/* ===== SYSTEM ADMINISTRATION (LIVE) ===== */}
      {activeView === "dashboard" && (
        <>
          <div className="page-header">
            <h1 className="page-title">System Administration</h1>
            <p className="page-subtitle">
              Live overview of users, API health, and model status
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: "#667eea" }}>
                {metrics.active_users}
              </div>
              <div className="stat-label">Active Users</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: "#f59e0b" }}>
                {metrics.pending_users}
              </div>
              <div className="stat-label">Pending Approvals</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: "#10b981" }}>
                {apiLatencyMs != null ? `${apiLatencyMs}ms` : "—"}
              </div>
              <div className="stat-label">API Latency (health)</div>
            </div>

            <div className="stat-card">
              <div className="stat-value" style={{ color: "#667eea" }}>
                {modelInfo?.model || "—"}
              </div>
              <div className="stat-label">Model Loaded</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            {/* System Health */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">System Health</h3>
              </div>

              <div>
                {/* API response time bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>API Response Time</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>
                      {apiLatencyMs != null ? `${apiLatencyMs}ms` : "—"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${latencyPct}%`, height: "100%", background: "#10b981" }} />
                  </div>
                </div>

                {/* Database users proportion */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Database Users</span>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>
                      {metrics.total_users}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${
                          metrics.total_users > 0
                            ? Math.min(100, Math.round((metrics.active_users / metrics.total_users) * 100))
                            : 0
                        }%`,
                        height: "100%",
                        background: "#10b981",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: ".85rem", color: "var(--muted)", marginTop: 6 }}>
                    Active: {metrics.active_users} / {metrics.total_users}
                  </div>
                </div>

                {/* Uptime */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>API Uptime</span>
                    <span style={{ color: "#667eea", fontWeight: 700 }}>
                      {uptimeMs ? formatDuration(uptimeMs) : "—"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: "100%", height: "100%", background: "#667eea", opacity: .25 }} />
                  </div>
                  <div style={{ fontSize: ".85rem", color: "var(--muted)", marginTop: 6 }}>
                    Last user: {metrics.last_registered_email || "—"}{" "}
                    {metrics.last_registered_at
                      ? `(${new Date(metrics.last_registered_at).toLocaleString()})`
                      : ""}
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
                <button
                  className="btn btn-secondary"
                  style={{ width: "100%", marginBottom: 8 }}
                  onClick={() => Promise.allSettled([fetchModelInfo(), measureLatency(), fetchMetrics()])}
                >
                  Refresh Status
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

      {/* ===== USER MANAGEMENT (live) ===== */}
      {activeView === "users" && (
        <>
          <div className="page-header">
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">Approve users and assign roles</p>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pending User Approvals</h3>
              <span className="badge badge-pending">
                {loadingUsers ? "Loading…" : `${pending.length} Pending`}
              </span>
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
                {pending.length === 0 && !loadingUsers && (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--muted)" }}>
                      No pending users.
                    </td>
                  </tr>
                )}
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || "-"}</td>
                    <td>{u.email}</td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleString() : "-"}</td>
                    <td>
                      <select
                        className="form-input"
                        value={roleChoice[u.id] || ""}
                        onChange={(e) => setRoleChoice((s) => ({ ...s, [u.id]: e.target.value }))}
                        style={{ padding: "6px 12px", fontSize: ".875rem" }}
                      >
                        <option value="">Select role…</option>
                        <option value="customer">Customer</option>
                        <option value="analyst">Analyst</option>
                        <option value="regulator">Regulator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-success"
                          style={{ padding: "6px 12px", fontSize: ".75rem", marginRight: 4 }}
                          onClick={() => approveUser(u)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: "6px 12px", fontSize: ".75rem" }}
                          onClick={() => deactivateUser(u)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Active Users</h3>
              <button className="btn btn-primary" onClick={fetchUsers}>
                Refresh
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.length === 0 && !loadingUsers && (
                  <tr>
                    <td colSpan={6} style={{ color: "var(--muted)" }}>
                      No active users yet.
                    </td>
                  </tr>
                )}
                {activeUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || "-"}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-review">{u.role || "-"}</span>
                    </td>
                    <td>
                      <span className="badge badge-approved">
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleString() : "-"}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: ".75rem" }}
                        onClick={() => deactivateUser(u)}
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== MODEL CONFIG VIEW (unchanged) ===== */}
      {activeView === "model" && (
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
                  <option defaultValue>SHAP (Recommended)</option>
                  <option>LIME</option>
                  <option>Both Methods</option>
                </select>
                <p style={{ fontSize: ".9rem", color: "var(--muted)", marginTop: 6 }}>
                  Based on research, SHAP provides higher consistency
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Risk Threshold</label>
                <input type="range" className="form-input" min="0" max="1" step="0.01" defaultValue="0.7" />
              </div>

              <button className="btn btn-primary">Save Configuration</button>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Current Model</h3>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: ".95rem", color: "var(--muted)", marginBottom: 4 }}>Model Type</div>
                <div style={{ fontWeight: 700 }}>{modelInfo?.model || "—"}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: ".95rem", color: "var(--muted)", marginBottom: 4 }}>Feature Columns</div>
                <div style={{ fontWeight: 700 }}>{modelInfo?.features?.length ?? "—"}</div>
              </div>

              <button className="btn btn-secondary" style={{ width: "100%" }} onClick={fetchModelInfo}>
                Refresh Model Info
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
  );
}
