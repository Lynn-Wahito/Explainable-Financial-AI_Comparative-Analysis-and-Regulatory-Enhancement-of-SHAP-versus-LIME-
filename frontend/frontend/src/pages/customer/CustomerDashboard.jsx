// src/pages/customer/CustomerDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/customer.css";
import { BarChart3, Target, TrendingUp, CheckCircle } from "lucide-react";


const API_BASE = "http://127.0.0.1:8000";

// Fresh token every call
function getToken() {
  return localStorage.getItem("access_token") || "";
}

const commonHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${getToken()}`,
});

function badgeFor(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("approve")) return "badge-approved";
  if (s.includes("pend") || s.includes("review")) return "badge-pending";
  if (s.includes("declin")) return "badge-declined";
  return "badge-review";
}

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ---------- UCI defaults builder (uses actual UCI row, no synthetic amounts) ----------
function buildUciDefaultsFromHistory({ credit_limit, history_summary, uci_row }) {
  const row = uci_row || history_summary?.raw_record || null;

  const getNum = (v, fallback = 0) => {
    if (v === null || v === undefined || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const rawLimit =
    (row && (row.LIMIT_BAL ?? row.limit_balance)) ??
    credit_limit ??
    200000;
  const limit = getNum(rawLimit, 200000);

  const bill = [
    getNum(row?.BILL_AMT1),
    getNum(row?.BILL_AMT2),
    getNum(row?.BILL_AMT3),
    getNum(row?.BILL_AMT4),
    getNum(row?.BILL_AMT5),
    getNum(row?.BILL_AMT6),
  ];

  const pay = [
    getNum(row?.PAY_AMT1),
    getNum(row?.PAY_AMT2),
    getNum(row?.PAY_AMT3),
    getNum(row?.PAY_AMT4),
    getNum(row?.PAY_AMT5),
    getNum(row?.PAY_AMT6),
  ];

  const statuses = [
    getNum(row?.PAY_0),
    getNum(row?.PAY_2),
    getNum(row?.PAY_3),
    getNum(row?.PAY_4),
    getNum(row?.PAY_5),
    getNum(row?.PAY_6),
  ];

  const sex = row?.SEX ?? row?.sex ?? null;
  const education = row?.EDUCATION ?? row?.education ?? null;
  const marriage = row?.MARRIAGE ?? row?.marriage ?? null;
  const age = row?.AGE ?? row?.age ?? null;

  return {
    sex,
    education,
    marriage,
    age,
    limit_balance: Math.max(50000, Math.round(limit)),
    pay_0: statuses[0],
    pay_2: statuses[1],
    pay_3: statuses[2],
    pay_4: statuses[3],
    pay_5: statuses[4],
    pay_6: statuses[5],
    bill_amt1: bill[0],
    bill_amt2: bill[1],
    bill_amt3: bill[2],
    bill_amt4: bill[3],
    bill_amt5: bill[4],
    bill_amt6: bill[5],
    pay_amt1: pay[0],
    pay_amt2: pay[1],
    pay_amt3: pay[2],
    pay_amt4: pay[3],
    pay_amt5: pay[4],
    pay_amt6: pay[5],
  };
}

function extractRiskScore(report) {
  if (!report) return null;

  // Prefer explicit prob fields first
  const prob =
    report.prob_default ??
    report.risk_score ??
    report.probability ??
    report.result?.prob_default ??
    report.result?.probability ??
    null;

  if (prob == null) return null;

  const n = Number(prob);
  if (!Number.isFinite(n)) return null;

  // In case the backend ever sends a percentage (e.g., 29 instead of 0.29)
  // if (n > 1) return n / 100;

  return n; // keep as probability 0–1
}

export default function CustomerDashboard() {
  const nav = useNavigate();
  const [theme, setTheme] = useState("light");
  const [activeView, setActiveView] = useState("dashboard");
  const [applications, setApplications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, totalLimit: 0 });
  const [selectedApp, setSelectedApp] = useState(null);

  const [prefill, setPrefill] = useState(null);
  const [uciDefaults, setUciDefaults] = useState(null);
  const [prefillError, setPrefillError] = useState("");
  const [uiError, setUiError] = useState("");

  const [appReport, setAppReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  const handleAuthFail = (res) => {
    if ([401, 403].includes(res.status)) {
      localStorage.removeItem("access_token");
      nav("/login");
      return true;
    }
    return false;
  };

  async function fetchApplications() {
    const res = await fetch(`${API_BASE}/customer/applications`, {
      method: "GET",
      headers: commonHeaders(),
      cache: "no-store",
    });
    if (handleAuthFail(res)) return;
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load applications");

    const list = Array.isArray(data) ? data : data.applications || [];

    const normalized = list.map((a, i) => ({
      id: a.id ?? a.app_id ?? `APP-${i + 1}`,
      amount: a.amount,
      purpose: a.purpose || a.loan_purpose || "—",
      status: a.status || a.decision || "Pending",
      submitted: a.submitted || "—",
    }));
    setApplications(normalized);
  }

  async function fetchDashboard() {
    const res = await fetch(`${API_BASE}/customer/dashboard`, {
      method: "GET",
      headers: commonHeaders(),
      cache: "no-store",
    });
    if (handleAuthFail(res)) return;
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (!res.ok) throw new Error(data.detail || `Failed to fetch dashboard (${res.status})`);

    const prof =
      data.profile ||
      (data.user
        ? {
            name:
              [data.user.first_name, data.user.last_name]
                .filter(Boolean)
                .join(" ") ||
              data.user.username ||
              "Customer",
            email: data.user.email,
          }
        : null) ||
      { name: "Customer" };
    setProfile(prof);

    if (Array.isArray(data.applications)) {
      const normalized = data.applications.map((a, i) => ({
        id: a.id ?? a.app_id ?? `APP-${i + 1}`,
        amount: a.amount,
        purpose: a.purpose || a.loan_purpose || "—",
        status: a.status || a.decision || "Pending",
        submitted: a.submitted || "—",
      }));
      setApplications(normalized);
    }

    const pendingRaw =
      data.credit?.pending_count ??
      data.metrics?.pending ??
      0;

    const approvedRaw =
      data.credit?.approved_count ??
      data.metrics?.approved ??
      0;

    const totalLimitRaw =
      data.credit?.total_limit ??
      data.metrics?.total_limit ??
      data.credit_limit ??
      data.limit_balance ??
      0;

    setStats({
      pending: Number(pendingRaw) || 0,
      approved: Number(approvedRaw) || 0,
      totalLimit: Number(totalLimitRaw) || 0,
    });
  }

  async function fetchPrefill() {
    setPrefillError("");
    try {
      const res = await fetch(`${API_BASE}/customer/apply/prefill`, {
        method: "GET",
        headers: commonHeaders(),
        cache: "no-store",
      });
      if (handleAuthFail(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch prefill");

      setPrefill(data);

      setStats((prev) => {
        let newLimit = prev.totalLimit || 0;
        if (data && data.limit_balance !== undefined && data.limit_balance !== null) {
          const parsed = Number(data.limit_balance);
          if (!Number.isNaN(parsed)) newLimit = parsed;
        } else if (data && data.credit_limit !== undefined && data.credit_limit !== null) {
          const parsed = Number(data.credit_limit);
          if (!Number.isNaN(parsed)) newLimit = parsed;
        }
        return { ...prev, totalLimit: newLimit };
      });

      const uci = buildUciDefaultsFromHistory({
        credit_limit: data.credit_limit,
        history_summary: data.history_summary,
        uci_row: data.uci_row || data.assigned_record || data.raw_uci || null,
      });
      setUciDefaults(uci);
    } catch (e) {
      console.error(e);
      setPrefillError("Could not prefill from history.");
      setPrefill(null);
      setUciDefaults(null);
    }
  }

  useEffect(() => {
  (async () => {
    try {
      const t = getToken();
      if (!t) {
        nav("/login");
        return;
      }
      setUiError("");

      const tasks = [fetchDashboard()];
      if (!applications.length) {
        tasks.push(fetchApplications());
      }

      await Promise.all(tasks);
    } catch (err) {
      console.error(err);
      setUiError(err.message || "Failed to load dashboard");
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);


  useEffect(() => {
    if (activeView === "apply") {
      fetchPrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  function viewApplication(app) {
    setSelectedApp(app);
    setActiveView("status");
    setAppReport(null);
    setReportError("");
    setLoadingReport(true);

    fetch(`${API_BASE}/customer/applications/${app.id}/report`, {
      method: "GET",
      headers: commonHeaders(),
      cache: "no-store",
    })
      .then(async (res) => {
        if (handleAuthFail(res)) return;
        let data = {};
        try {
          data = await res.json();
        } catch (_) {}
        if (!res.ok) {
          throw new Error(data.detail || "Could not load explanation for this application");
        }
        setAppReport(data || null);
      })
      .catch((err) => {
        console.error("report error", err);
        setReportError(err.message || "Explanation is not available yet.");
      })
      .finally(() => {
        setLoadingReport(false);
      });
  }

  async function submitApplication(e) {
    e.preventDefault();
    const form = e.target;

    const amountReq = Number(form.amount.value);
    const limit = Number(prefill?.credit_limit ?? stats.totalLimit ?? 0);
    if (limit > 0 && amountReq > limit) {
      alert(
        `Requested amount Ksh ${amountReq.toLocaleString()} exceeds your credit limit ` +
          `Ksh ${limit.toLocaleString()}. Please lower the amount.`
      );
      return;
    }

    const payload = {
      amount: amountReq,
      purpose: form.purpose.value,
      term_months: parseInt(form.term.value, 10),

      full_name: form.full_name?.value || undefined,
      email: form.email?.value || undefined,
      national_id: form.national_id?.value || undefined,
      phone: form.phone?.value || undefined,

      employment_status: form.employment?.value || undefined,
      annual_income: numOrNull(form.income?.value),
      housing_payment: numOrNull(form.housing?.value),
      other_debt: numOrNull(form.debt?.value),

      limit_balance: numOrNull(form.limit_balance.value),
      sex: form.sex.value === "" ? null : Number(form.sex.value),
      education: form.education.value === "" ? null : Number(form.education.value),
      marriage: form.marriage.value === "" ? null : Number(form.marriage.value),
      age: numOrNull(form.age.value),

      pay_0: form.pay_0.value === "" ? null : Number(form.pay_0.value),
      pay_2: form.pay_2.value === "" ? null : Number(form.pay_2.value),
      pay_3: form.pay_3.value === "" ? null : Number(form.pay_3.value),
      pay_4: form.pay_4.value === "" ? null : Number(form.pay_4.value),
      pay_5: form.pay_5.value === "" ? null : Number(form.pay_5.value),
      pay_6: form.pay_6.value === "" ? null : Number(form.pay_6.value),

      bill_amt1: numOrNull(form.bill_amt1.value),
      bill_amt2: numOrNull(form.bill_amt2.value),
      bill_amt3: numOrNull(form.bill_amt3.value),
      bill_amt4: numOrNull(form.bill_amt4.value),
      bill_amt5: numOrNull(form.bill_amt5.value),
      bill_amt6: numOrNull(form.bill_amt6.value),

      pay_amt1: numOrNull(form.pay_amt1.value),
      pay_amt2: numOrNull(form.pay_amt2.value),
      pay_amt3: numOrNull(form.pay_amt3.value),
      pay_amt4: numOrNull(form.pay_amt4.value),
      pay_amt5: numOrNull(form.pay_amt5.value),
      pay_amt6: numOrNull(form.pay_amt6.value),
    };

    try {
      const res = await fetch(`${API_BASE}/customer/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...commonHeaders() },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (handleAuthFail(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Application failed");

      await fetchApplications();
      setActiveView("dashboard");
    } catch (err) {
      console.error("❌ ", err.message);
      alert(err.message || "Application failed");
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    nav("/login");
  }

  const effectiveLimit = useMemo(
    () => Number(prefill?.credit_limit ?? stats.totalLimit ?? 0),
    [prefill, stats]
  );

  if (!getToken()) {
    return <div className="customer-scope">No session. Redirecting to login…</div>;
  }

    const metrics = [
    {
      title: "Accuracy",
      value: "81.63%",
      numeric: 81.63,
      icon: Target,
      description:
        "Overall correctness of predictions across all credit default cases.",
      gradientKey: "emeraldTeal",
    },
    {
      title: "ROC-AUC Score",
      value: "77.98%",
      numeric: 77.98,
      icon: TrendingUp,
      description:
        "Ability of the model to distinguish between default and non-default clients.",
      gradientKey: "blueCyan",
    },
    {
      title: "F1 Score",
      value: "46.76%",
      numeric: 46.76,
      icon: BarChart3,
      description:
        "Balance between precision and recall. Useful when defaults are rare.",
      gradientKey: "purpleIndigo",
    },
    {
      title: "Precision",
      value: "65.14%",
      numeric: 65.14,
      icon: CheckCircle,
      description:
        "Out of all clients predicted as high-risk, how many actually default.",
      gradientKey: "orangeAmber",
    },
    {
      title: "Recall",
      value: "36.47%",
      numeric: 36.47,
      icon: CheckCircle,
      description:
        "Out of all clients who default, how many the model correctly catches.",
      gradientKey: "pinkRose",
    },
  ];

  const gradientStyles = {
    emeraldTeal: "linear-gradient(135deg, #10b981, #0f766e)", // from-emerald-500 to-teal-600
    blueCyan: "linear-gradient(135deg, #3b82f6, #0891b2)",   // from-blue-500 to-cyan-600
    purpleIndigo: "linear-gradient(135deg, #8b5cf6, #4f46e5)", // from-purple-500 to-indigo-600
    orangeAmber: "linear-gradient(135deg, #f97316, #f59e0b)",  // from-orange-500 to-amber-600
    pinkRose: "linear-gradient(135deg, #ec4899, #f43f5e)",     // from-pink-500 to-rose-600
  };

  return (
    <div className={`customer-scope theme-${theme}`}>
      <div className="navbar">
        <div className="logo">CreditAI</div>
        <div className="nav-items">
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ?  "🌙 Dark" : "🌞 Light"}
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

      <aside className="sidebar">
        <button
          className={`sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveView("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          className={`sidebar-item ${activeView === "apply" ? "active" : ""}`}
          onClick={async () => {
            await fetchPrefill();
            setActiveView("apply");
          }}
        >
          ➕ New Application
        </button>
        <button
          className={`sidebar-item ${activeView === "applications" ? "active" : ""}`}
          onClick={() => setActiveView("applications")}
        >
          📁 My Applications
        </button>
        <button
          className={`sidebar-item ${activeView === "history" ? "active" : ""}`}
          onClick={async () => {
            await fetchPrefill();
            setActiveView("history");
          }}
        >
          📜 History
        </button>
                <button
          className={`sidebar-item ${
            activeView === "model_evaluation" ? "active" : ""
          }`}
          onClick={() => setActiveView("model_evaluation")}
        >
          📐 Model Evaluation
        </button>
        <button className="sidebar-item" onClick={handleLogout}>
          🚪 Logout
        </button>
      </aside>

      <main className="main">
        {activeView === "dashboard" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">
                Welcome back, {(profile?.name || "Customer").split(" ")[0]}!
              </h1>
              <p className="page-subtitle">
                Track your loan applications and manage your account
              </p>
              {uiError && (
                <div className="alert alert-warn" style={{ marginTop: 12 }}>
                  {uiError}
                </div>
              )}
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
                  onClick={async () => {
                    await fetchPrefill();
                    setActiveView("apply");
                  }}
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
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", color: "var(--muted)" }}
                      >
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
                          <button
                            className="btn btn-secondary"
                            onClick={() => viewApplication(a)}
                          >
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

        {activeView === "applications" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">My Applications</h1>
              <p className="page-subtitle">
                Overview of your submitted applications
              </p>
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
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", color: "var(--muted)" }}
                      >
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
                          <span className={`badge ${badgeFor(a.status)}`}>
                            {a.status}
                          </span>
                        </td>
                        <td>{a.submitted}</td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            onClick={() => viewApplication(a)}
                          >
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

        {activeView === "apply" && (
          <div className="content full">
            <div className="page-header">
              <h1 className="page-title">Apply for a Loan</h1>
              <p className="page-subtitle">Fill out the application form below</p>
            </div>

            {prefillError && (
              <div className="alert alert-warn" style={{ marginBottom: 12 }}>
                {prefillError}
              </div>
            )}

            {effectiveLimit > 0 && (
              <div
                style={{
                  background: "var(--info-soft)",
                  border: "1px solid var(--info-border)",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  color: "var(--info-strong)",
                  fontSize: 14,
                }}
              >
                <strong>Your credit limit:</strong>{" "}
                Ksh {effectiveLimit.toLocaleString()} — Requests above this will
                be blocked.
              </div>
            )}

            <div className="card apply-card">
              <form
                className="apply-form"
                onSubmit={submitApplication}
                key={JSON.stringify(uciDefaults || {})}
              >
                <h3 className="section-title">Your Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      name="full_name"
                      type="text"
                      defaultValue={
                        prefill?.profile?.full_name || profile?.name || ""
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      name="email"
                      type="email"
                      defaultValue={
                        prefill?.profile?.email || profile?.email || ""
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">National ID / Passport</label>
                    <input className="form-input" name="national_id" type="text" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" name="phone" type="tel" />
                  </div>
                </div>

                <h3 className="section-title">Loan Details</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Loan Amount (Ksh)</label>
                    <input
                      className="form-input"
                      name="amount"
                      type="number"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Loan Purpose</label>
                    <select className="form-input" name="purpose" required>
                      <option value="">Select purpose...</option>
                      <option value="personal">Personal</option>
                      <option value="education">Education</option>
                      <option value="medical">Medical</option>
                      <option value="business">Business</option>
                      <option value="home">Home</option>
                      <option value="auto">Auto</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Term (months)</label>
                    <select className="form-input" name="term" required>
                      <option>6</option>
                      <option>12</option>
                      <option>18</option>
                      <option>24</option>
                      <option>36</option>
                      <option>48</option>
                      <option>60</option>
                    </select>
                  </div>
                </div>

                <h3 className="section-title">Financial Profile</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Annual Income (Ksh)</label>
                    <input
                      className="form-input"
                      name="income"
                      type="number"
                      defaultValue={prefill?.profile?.annual_income ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Status</label>
                    <select
                      className="form-input"
                      name="employment"
                      defaultValue={
                        prefill?.profile?.employment_status ||
                        "Full-time Employed"
                      }
                    >
                      <option>Full-time Employed</option>
                      <option>Part-time Employed</option>
                      <option>Self-employed</option>
                      <option>Unemployed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Monthly Housing Payment (Ksh)
                    </label>
                    <input
                      className="form-input"
                      name="housing"
                      type="number"
                      defaultValue={prefill?.profile?.housing_payment ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Other Monthly Debt (Ksh)</label>
                    <input
                      className="form-input"
                      name="debt"
                      type="number"
                      defaultValue={prefill?.profile?.other_debt ?? ""}
                    />
                  </div>
                </div>

                <h3 className="section-title">Profile (UCI Controls)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Credit Limit (LIMIT_BAL)</label>
                    <input
                      className="form-input"
                      name="limit_balance"
                      type="number"
                      placeholder="e.g. 200000"
                      defaultValue={
                        uciDefaults?.limit_balance ??
                        (effectiveLimit > 0
                          ? Math.max(50000, Math.round(effectiveLimit))
                          : "")
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sex</label>
                    <select
                      className="form-input"
                      name="sex"
                      defaultValue={uciDefaults?.sex ?? ""}
                    >
                      <option value="">— select —</option>
                      <option value="1">Male</option>
                      <option value="2">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Education</label>
                    <select
                      className="form-input"
                      name="education"
                      defaultValue={uciDefaults?.education ?? ""}
                    >
                      <option value="">— select —</option>
                      <option value="1">Postgraduate (Masters/PhD)</option>
                      <option value="2">University (Bachelor's)</option>
                      <option value="3">College / Polytechnic</option>
                      <option value="4">High School</option>
                      <option value="5">No Formal</option>
                      <option value="6">Others</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marital Status</label>
                    <select
                      className="form-input"
                      name="marriage"
                      defaultValue={uciDefaults?.marriage ?? ""}
                    >
                      <option value="">— select —</option>
                      <option value="1">Married</option>
                      <option value="2">Single</option>
                      <option value="3">Others</option>
                      <option value="0">Unknown</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Age (years)</label>
                    <input
                      className="form-input"
                      name="age"
                      type="number"
                      min="18"
                      max="100"
                      defaultValue={uciDefaults?.age ?? ""}
                    />
                  </div>
                </div>

                <h3 className="section-title">Repayment Status (−2 to 8)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">PAY_0 (most recent)</label>
                    <input
                      className="form-input"
                      name="pay_0"
                      type="number"
                      min="-2"
                      max="8"
                      defaultValue={uciDefaults?.pay_0 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_2</label>
                    <input
                      className="form-input"
                      name="pay_2"
                      type="number"
                      min="-2"
                      max="8"
                      defaultValue={uciDefaults?.pay_2 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_3</label>
                    <input
                      className="form-input"
                      name="pay_3"
                      type="number"
                      min="-2"
                      max="8"
                      defaultValue={uciDefaults?.pay_3 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_4</label>
                    <input
                      className="form-input"
                      name="pay_4"
                      type="number"
                      min="-2"
                      max="8"
                      defaultValue={uciDefaults?.pay_4 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_5</label>
                    <input
                      className="form-input"
                      name="pay_5"
                      type="number"
                      min="-2"
                      max="8"
                      defaultValue={uciDefaults?.pay_5 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_6 (oldest)</label>
                    <input
                      className="form-input"
                      name="pay_6"
                      type="number"
                      min="-2"
                      max="8"
                      defaultValue={uciDefaults?.pay_6 ?? ""}
                    />
                  </div>
                </div>

                <h3 className="section-title">Bill Amounts (most recent → older)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">BILL_AMT1</label>
                    <input
                      className="form-input"
                      name="bill_amt1"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.bill_amt1 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BILL_AMT2</label>
                    <input
                      className="form-input"
                      name="bill_amt2"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.bill_amt2 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BILL_AMT3</label>
                    <input
                      className="form-input"
                      name="bill_amt3"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.bill_amt3 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BILL_AMT4</label>
                    <input
                      className="form-input"
                      name="bill_amt4"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.bill_amt4 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BILL_AMT5</label>
                    <input
                      className="form-input"
                      name="bill_amt5"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.bill_amt5 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">BILL_AMT6</label>
                    <input
                      className="form-input"
                      name="bill_amt6"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.bill_amt6 ?? ""}
                    />
                  </div>
                </div>

                <h3 className="section-title">Payment Amounts (most recent → older)</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">PAY_AMT1</label>
                    <input
                      className="form-input"
                      name="pay_amt1"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.pay_amt1 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_AMT2</label>
                    <input
                      className="form-input"
                      name="pay_amt2"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.pay_amt2 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_AMT3</label>
                    <input
                      className="form-input"
                      name="pay_amt3"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.pay_amt3 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_AMT4</label>
                    <input
                      className="form-input"
                      name="pay_amt4"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.pay_amt4 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_AMT5</label>
                    <input
                      className="form-input"
                      name="pay_amt5"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.pay_amt5 ?? ""}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAY_AMT6</label>
                    <input
                      className="form-input"
                      name="pay_amt6"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={uciDefaults?.pay_amt6 ?? ""}
                    />
                  </div>
                </div>

                <div className="actions">
                  <button type="submit" className="btn btn-primary">
                    Submit Application
                  </button>
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

        {activeView === "history" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Credit History (UCI Record)</h1>
              <p className="page-subtitle">
                This shows the assigned historical credit pattern used to mimic
                your past payments.
              </p>
            </div>

            <div className="card">
              {!uciDefaults ? (
                <p style={{ color: "var(--muted)" }}>
                  No history loaded yet. Open the “Apply for Loan” page to
                  generate a record based on the UCI dataset.
                </p>
              ) : (
                <>
                  <h3 className="card-title">Summary</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div className="muted">Credit Limit</div>
                      <div className="strong">
                        Ksh{" "}
                        {Number(uciDefaults.limit_balance || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="muted">Age (years)</div>
                      <div className="strong">{uciDefaults.age ?? "—"}</div>
                    </div>
                    <div>
                      <div className="muted">Education Code</div>
                      <div className="strong">{uciDefaults.education ?? "—"}</div>
                    </div>
                    <div>
                      <div className="muted">Marital Status Code</div>
                      <div className="strong">{uciDefaults.marriage ?? "—"}</div>
                    </div>
                  </div>

                  <h3 className="card-title">Repayment Status (PAY_*)</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>PAY Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Most Recent (PAY_0)</td>
                        <td>{uciDefaults.pay_0}</td>
                      </tr>
                      <tr>
                        <td>PAY_2</td>
                        <td>{uciDefaults.pay_2}</td>
                      </tr>
                      <tr>
                        <td>PAY_3</td>
                        <td>{uciDefaults.pay_3}</td>
                      </tr>
                      <tr>
                        <td>PAY_4</td>
                        <td>{uciDefaults.pay_4}</td>
                      </tr>
                      <tr>
                        <td>PAY_5</td>
                        <td>{uciDefaults.pay_5}</td>
                      </tr>
                      <tr>
                        <td>Oldest (PAY_6)</td>
                        <td>{uciDefaults.pay_6}</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="card-title" style={{ marginTop: 24 }}>
                    Bill & Payment Amounts
                  </h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Bill Amount</th>
                        <th>Payment Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1 (most recent)</td>
                        <td>{uciDefaults.bill_amt1}</td>
                        <td>{uciDefaults.pay_amt1}</td>
                      </tr>
                      <tr>
                        <td>2</td>
                        <td>{uciDefaults.bill_amt2}</td>
                        <td>{uciDefaults.pay_amt2}</td>
                      </tr>
                      <tr>
                        <td>3</td>
                        <td>{uciDefaults.bill_amt3}</td>
                        <td>{uciDefaults.pay_amt3}</td>
                      </tr>
                      <tr>
                        <td>4</td>
                        <td>{uciDefaults.bill_amt4}</td>
                        <td>{uciDefaults.pay_amt4}</td>
                      </tr>
                      <tr>
                        <td>5</td>
                        <td>{uciDefaults.bill_amt5}</td>
                        <td>{uciDefaults.pay_amt5}</td>
                      </tr>
                      <tr>
                        <td>6 (oldest)</td>
                        <td>{uciDefaults.bill_amt6}</td>
                        <td>{uciDefaults.pay_amt6}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}

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
                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      padding: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <div
                        className="badge badge-approved"
                        style={{ display: "inline-block" }}
                      >
                        ✓
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        Submitted
                      </div>
                      <div
                        style={{ fontSize: 12, color: "var(--muted)" }}
                      >
                        {selectedApp.submitted}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        className="badge badge-review"
                        style={{ display: "inline-block" }}
                      >
                        ✓
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        AI Analysis
                      </div>
                      <div
                        style={{ fontSize: 12, color: "var(--muted)" }}
                      >
                        Completed
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        className={`badge ${badgeFor(selectedApp.status)}`}
                        style={{ display: "inline-block" }}
                      >
                        {selectedApp.status
                          .toLowerCase()
                          .includes("pend")
                          ? "…"
                          : "✓"}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        Officer Review
                      </div>
                      <div
                        style={{ fontSize: 12, color: "var(--muted)" }}
                      >
                        {selectedApp.status
                          .toLowerCase()
                          .includes("pend")
                          ? "In Progress"
                          : "Complete"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div
                        className="badge badge-pending"
                        style={{ display: "inline-block" }}
                      >
                        •
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        Decision
                      </div>
                      <div
                        style={{ fontSize: 12, color: "var(--muted)" }}
                      >
                        {selectedApp.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title">Application Details</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 24,
                      marginTop: 20,
                    }}
                  >
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Loan Amount</div>
                        <div className="strong">
                          Ksh{" "}
                          {Number(selectedApp.amount || 0).toLocaleString()}
                        </div>
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
                        <span
                          className={`badge ${badgeFor(selectedApp.status)}`}
                        >
                          {selectedApp.status}
                        </span>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Estimated Decision</div>
                        <div className="strong">
                          Within 2–3 business days
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div className="muted">Reference Number</div>
                        <div
                          className="strong"
                          style={{ fontFamily: "monospace" }}
                        >
                          {selectedApp.id}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 24 }}
                    onClick={() => setActiveView("dashboard")}
                  >
                    Back to Dashboard
                  </button>
                </div>

                <div className="card">
                  <h3 className="card-title">Why this decision?</h3>

                  {loadingReport && (
                    <p style={{ color: "var(--muted)" }}>
                      Loading explanation for this application…
                    </p>
                  )}

                  {reportError && !loadingReport && (
                    <p className="alert alert-warn">{reportError}</p>
                  )}

                  {!loadingReport && !reportError && !appReport && (
                    <p style={{ color: "var(--muted)" }}>
                      An explanation for this decision is not yet available. Please
                      check again later.
                    </p>
                  )}

                  {appReport && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <div className="muted">Risk Score</div>
                            <div className="strong">
                              {appReport.risk_score != null
                                ? Number(appReport.risk_score).toFixed(2)   // e.g. 0.06
                                : "—"}
                            </div>
                        </div>
                        <div>
                          <div className="muted">Risk Level</div>
                          <div className="strong">
                            {appReport.risk_band || appReport.risk_level || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="muted">Model</div>
                          <div className="strong">
                            {appReport.model_name || "XGBoost (credit default)"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 24,
                          marginTop: 8,
                        }}
                      >
                        <div>
                          <h4 style={{ marginBottom: 8 }}>Strength Indicators</h4>
                          {Array.isArray(appReport.strength_indicators) &&
                          appReport.strength_indicators.length > 0 ? (
                            <ul className="bullet-list">
                              {appReport.strength_indicators.map((s, i) => (
                                <li key={`strength-${i}`}>{s}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">No strengths recorded.</p>
                          )}
                        </div>
                        <div>
                          <h4 style={{ marginBottom: 8 }}>Risk Indicators</h4>
                          {Array.isArray(appReport.risk_indicators) &&
                          appReport.risk_indicators.length > 0 ? (
                            <ul className="bullet-list">
                              {appReport.risk_indicators.map((s, i) => (
                                <li key={`risk-${i}`}>{s}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">No specific risk flags.</p>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 24,
                          marginTop: 24,
                        }}
                      >
                        <div>
                          <h4 className="card-subtitle">SHAP feature analysis</h4>
                          {Array.isArray(appReport.shap_top) &&
                          appReport.shap_top.length > 0 ? (
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Feature</th>
                                  <th>Value</th>
                                  <th>Impact</th>
                                </tr>
                              </thead>
                              <tbody>
                                {appReport.shap_top.map((f, i) => (
                                  <tr key={`shap-${i}`}>
                                    <td>{f.feature || f.name}</td>
                                    <td>
                                      {f.value != null
                                        ? Number(f.value).toLocaleString()
                                        : "—"}
                                    </td>
                                    <td>
                                      {(f.impact ?? f.weight) != null
                                        ? Number(f.impact ?? f.weight).toFixed(2)
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="muted">
                              SHAP explanation was not generated for this
                              application.
                            </p>
                          )}
                        </div>

                        <div>
                          <h4 className="card-subtitle">LIME feature analysis</h4>
                          {Array.isArray(appReport.lime_top) &&
                          appReport.lime_top.length > 0 ? (
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Feature</th>
                                  <th>Value</th>
                                  <th>Impact</th>
                                </tr>
                              </thead>
                              <tbody>
                                {appReport.lime_top.map((f, i) => (
                                  <tr key={`lime-${i}`}>
                                    <td>{f.feature || f.name}</td>
                                    <td>
                                      {f.value != null
                                        ? Number(f.value).toLocaleString()
                                        : "—"}
                                    </td>
                                    <td>
                                      {(f.impact ?? f.weight) != null
                                        ? Number(f.impact ?? f.weight).toFixed(2)
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="muted">
                              LIME explanation was not generated for this
                              application.
                            </p>
                          )}
                        </div>
                      </div>

                      {appReport.model_note && (
                        <p
                          style={{
                            marginTop: 20,
                            fontSize: 13,
                            color: "var(--muted)",
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                            paddingTop: 12,
                          }}
                        >
                          <strong>Model interpretation note:</strong>{" "}
                          {appReport.model_note}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

                {activeView === "model_evaluation" && (
          <div className="content">
            <div className="page-header">
              <h1 className="page-title">Model Evaluation</h1>
              <p className="page-subtitle">
                Performance of the XGBoost credit-risk model on the test set.
              </p>
            </div>

            {/* Metrics grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {metrics.map((metric, idx) => {
                const Icon = metric.icon;
                const gradient = gradientStyles[metric.gradientKey];

                return (
                  <div
                    key={idx}
                    className="card model-metric-card"
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      border:
                        "1px solid rgba(148, 163, 184, 0.35)", // slate-ish border
                    }}
                  >
                    {/* soft gradient overlay */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: gradient,
                        opacity: 0.08,
                        pointerEvents: "none",
                      }}
                    />

                    <div
                      style={{
                        position: "relative",
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        height: "100%",
                      }}
                    >
                      {/* Icon + pill */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            padding: 8,
                            borderRadius: 12,
                            backgroundImage: gradient,
                            boxShadow:
                              "0 10px 25px rgba(15, 23, 42, 0.35)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon size={20} color="#ffffff" />
                        </div>

                        <div
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            border: "1px solid rgba(148, 163, 184, 0.7)",
                            color: "var(--muted)",
                            background:
                              "rgba(15, 23, 42, 0.04)", // works for light+dark
                          }}
                        >
                          Test Set
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--foreground)",
                        }}
                      >
                        {metric.title}
                      </div>

                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          backgroundImage: gradient,
                          WebkitBackgroundClip: "text",
                          color: "transparent",
                          marginBottom: 4,
                        }}
                      >
                        {metric.value}
                      </div>

                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "var(--muted)",
                          flexGrow: 1,
                        }}
                      >
                        {metric.description}
                      </p>

                      {/* progress bar */}
                      <div
                        style={{
                          marginTop: 8,
                          height: 6,
                          borderRadius: 999,
                          background: "rgba(148, 163, 184, 0.25)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${metric.numeric}%`,
                            backgroundImage: gradient,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Extra info card */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 12 }}>
                About These Metrics
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 16,
                }}
              >
                <div>
                  <h4
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--primary)",
                      marginBottom: 4,
                    }}
                  >
                    Cross-Validation
                  </h4>
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    The model was trained with cross-validation to prevent
                    overfitting. During cross-validation the mean ROC-AUC was{" "}
                    <strong>78.04%</strong>, showing stable performance across
                    different folds.
                  </p>
                </div>
                <div>
                  <h4
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--primary)",
                      marginBottom: 4,
                    }}
                  >
                    Model Type
                  </h4>
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>
                    The production model is a calibrated{" "}
                    <strong>XGBoost</strong> classifier trained on the UCI
                    Credit Card dataset. SHAP and LIME explanations are
                    generated for each decision to support transparency and
                    regulatory review.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
