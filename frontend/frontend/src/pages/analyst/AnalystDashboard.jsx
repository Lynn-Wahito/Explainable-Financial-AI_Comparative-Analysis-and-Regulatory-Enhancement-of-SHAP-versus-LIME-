// src/pages/analyst/AnalystDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../../styles/analyst.css";

const API = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("access_token") || "";
}
function hasToken() {
  return !!getToken();
}
function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function riskColor(v) {
  if (v == null) return "var(--an-muted)";
  return Number(v) >= 0.6 ? "var(--an-danger)" : "var(--an-good)";
}
function fmtAmt(a) {
  const n = Number(a || 0);
  return `Ksh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function badgeClass(status = "") {
  const s = String(status || "").toLowerCase();
  if (s.includes("review")) return "an-badge-review";
  if (s.includes("pending") || s.includes("new") || s.includes("submitted"))
    return "an-badge-pending";
  if (s.includes("approved")) return "an-badge-good";
  if (s.includes("declined") || s.includes("rejected")) return "an-badge-bad";
  return "an-badge-neutral";
}
function topByAbs(arr, k = 8) {
  return [...(arr || [])]
    .sort((a, b) => Math.abs(b.weight || 0) - Math.abs(a.weight || 0))
    .slice(0, k);
}

// ---------- tiny bar visuals ----------
function BarRow({ label, value }) {
  const w = Math.min(100, Math.round(Math.abs(value) * 100));
  const dir = value >= 0 ? "pos" : "neg";
  return (
    <div className={`bar-row ${dir}`}>
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${w}%` }} />
      </div>
      <div className="bar-value">
        {(value >= 0 ? "+" : "") + value.toFixed(2)}
      </div>
    </div>
  );
}
function TopBars({ pairs }) {
  return (
    <div className="bar-list">
      {pairs.map((p, i) => (
        <BarRow
          key={i}
          label={`${p.feature} = ${Number(p.value).toFixed(2)}`}
          value={Number(p.weight)}
        />
      ))}
    </div>
  );
}
// -------------------------------------

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`);
  return data;
}

// ---- localStorage cache for risk & confidence ----
const METRIC_KEY_PREFIX = "creditai_metrics_";

function storeRiskMetrics(appId, risk, confidence) {
  try {
    const key = `${METRIC_KEY_PREFIX}${appId}`;
    localStorage.setItem(
      key,
      JSON.stringify({ risk: Number(risk), confidence: Number(confidence) })
    );
  } catch {
    // ignore
  }
}

function loadRiskMetrics(appId) {
  try {
    const key = `${METRIC_KEY_PREFIX}${appId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      typeof data.risk === "number" &&
      typeof data.confidence === "number"
    ) {
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

export default function AnalystDashboard() {
  const [theme, setTheme] = useState("light");
  const [view, setView] = useState("dashboard"); // "dashboard" | "review" | "reports"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(null);
  const [shap, setShap] = useState(null);
  const [lime, setLime] = useState(null);
  const [loadingExpl, setLoadingExpl] = useState(false);
  const [explErr, setExplErr] = useState("");
  const [speed, setSpeed] = useState({ shap_ms: null, lime_ms: null });

  const [summary, setSummary] = useState({
    pending_reviews: 0,
    approved_today: 0,
    high_risk_apps: 0,
  });
  const [modal, setModal] = useState({
    open: false,
    app_id: null,
    current: "pending",
  });

  // auto-hide toast popup after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  // ---- data loads
  async function loadPriority() {
    if (!hasToken()) {
      setErr("Not signed in.");
      return;
    }
    if (view !== "dashboard") return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/analytics/priority`, {
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      if (res.status === 401) {
        setErr("Your session expired. Please sign in again.");
        setRows([]);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Failed to load: ${res.status}`);
      }
      const data = await res.json();

      // Merge backend data with existing rows and compute CONFIDENCE = 1 - risk,
      // plus restore cached metrics from localStorage so values survive refresh.
      setRows((prev) => {
        const prevMap = {};
        for (const p of prev) {
          prevMap[String(p.app_id)] = p;
        }

        return (data || []).map((r) => {
          const appId = String(r.app_id ?? r.id ?? r.application_id ?? "");
          const prevRow = prevMap[appId];

          const backendRisk = r.risk;
          let mergedRisk =
            backendRisk === null || backendRisk === undefined
              ? prevRow && prevRow.risk != null
                ? Number(prevRow.risk)
                : null
              : Number(backendRisk);

          let mergedConfidence =
            mergedRisk != null
              ? 1 - mergedRisk
              : prevRow && prevRow.confidence != null
              ? Number(prevRow.confidence)
              : null;

          // fallback to cache if nothing yet
          if (mergedRisk == null || mergedConfidence == null) {
            const cached = loadRiskMetrics(appId);
            if (cached) {
              mergedRisk =
                mergedRisk != null ? mergedRisk : Number(cached.risk);
              mergedConfidence =
                mergedConfidence != null
                  ? mergedConfidence
                  : Number(cached.confidence);
            }
          }

          return {
            app_id: appId,
            name: r.name ?? prevRow?.name ?? "Unknown",
            amount: Number(r.amount ?? prevRow?.amount ?? 0),
            risk: mergedRisk,
            confidence: mergedConfidence,
            status: r.status ?? prevRow?.status ?? "pending",
          };
        });
      });
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    if (!hasToken() || view !== "dashboard") return;
    try {
      const res = await fetch(`${API}/analytics/summary`, {
        headers: authHeader(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSummary({
        pending_reviews: Number(data?.pending_reviews ?? 0),
        approved_today: Number(data?.approved_today ?? 0),
        high_risk_apps: Number(data?.high_risk_apps ?? 0),
      });
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let t = null;
    async function tick() {
      if (
        document.visibilityState === "visible" &&
        view === "dashboard" &&
        hasToken()
      ) {
        await Promise.all([loadPriority(), loadSummary()]);
      }
    }
    tick();
    t = setInterval(tick, 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (t) clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [view]);

  const kpis = useMemo(() => {
    const pending = rows.filter((r) =>
      ["pending", "for review", "submitted", "new", "manual_review"].includes(
        String(r.status || "").toLowerCase()
      )
    ).length;
    const approved = rows.filter((r) =>
      String(r.status || "").toLowerCase().includes("approved")
    ).length;
    const declined = rows.filter((r) => {
      const s = String(r.status || "").toLowerCase();
      return s.includes("declined") || s.includes("rejected");
    }).length;
    return { pending, approved, declined };
  }, [rows]);

  // ---- analyze flow
  async function analyzeRow(row) {
    // Block re-analysis if already finalized – but show a message
    const s = String(row.status || "").toLowerCase();
    if (["approved", "declined", "rejected"].includes(s)) {
      setToast(
        "This application already has a final decision and cannot be re-analysed."
      );
      return;
    }

    setSelected(row);
    setView("review");
    setLoadingExpl(true);
    setExplErr("");
    setScore(null);
    setShap(null);
    setLime(null);
    setSpeed({ shap_ms: null, lime_ms: null });

    try {
      const analyze = await postJSON(
        `${API}/analyst/applications/${row.app_id}/analyze`,
        {}
      );

      const features = analyze?.features_used || analyze?.features || null;
      if (!features || typeof features !== "object") {
        throw new Error("No features returned for explanations.");
      }

      // ✅ Use the backend result directly so dashboard & report match
      const prob =
        analyze?.result?.prob_default ??
        analyze?.result?.probability ??
        analyze?.result?.score ??
        null;

      if (prob != null) {
        const numericProb = Number(prob);
        const conf = 1 - numericProb;
        setScore(numericProb);

        // Update table rows
        setRows((prev) =>
          prev.map((r) =>
            String(r.app_id) === String(row.app_id)
              ? {
                  ...r,
                  risk: numericProb,
                  confidence: conf,
                }
              : r
          )
        );

        // Persist to localStorage so values survive refresh
        storeRiskMetrics(row.app_id, numericProb, conf);
      }

      const t0 = performance.now();
      const shapRes = await postJSON(`${API}/ml/xai/shap`, { features });
      const shapMs = Math.round(performance.now() - t0);

      const t1 = performance.now();
      const limeRes = await postJSON(`${API}/ml/xai/lime`, { features });
      const limeMs = Math.round(performance.now() - t1);

      const norm = (obj) => {
        const arr =
          obj?.contributions || obj?.explanations || obj?.pairs || obj?.data || [];
        return {
          contributions: (Array.isArray(arr) ? arr : []).map((p) => ({
            feature: p.feature ?? p.name ?? p.key ?? "feature",
            value: Number(p.value ?? 0),
            weight: Number(p.weight ?? p.shap ?? p.coeff ?? 0),
          })),
          error: obj?.error || null,
        };
      };
      setShap(norm(shapRes));
      setLime(norm(limeRes));
      setSpeed({ shap_ms: shapMs, lime_ms: limeMs });
    } catch (e) {
      setExplErr(e.message || "Failed to analyze");
    } finally {
      setLoadingExpl(false);
    }
  }

  // ---- decisions: ENABLED from analysis page
  async function setQuickDecision(appId, newStatus) {
    if (!appId) return;
    try {
      setToast("");
      const res = await fetch(`${API}/analyst/applications/${appId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          (data && data.detail) || `Failed to update status: ${res.status}`
        );
      }

      // Update rows table
      setRows((prev) =>
        prev.map((r) =>
          String(r.app_id) === String(appId)
            ? { ...r, status: newStatus }
            : r
        )
      );

      // Update selected card if open
      setSelected((prev) =>
        prev && String(prev.app_id) === String(appId)
          ? { ...prev, status: newStatus }
          : prev
      );

      const label =
        newStatus === "manual_review"
          ? "Review"
          : newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

      // popup confirmation + go back to dashboard
      setToast(`Application ${appId} updated to: ${label}`);
      setView("dashboard");
      setSelected(null);
    } catch (e) {
      setToast(e.message || "Failed to update status");
      setView("dashboard");
      setSelected(null);
    }
  }

  // ---- report download
  async function downloadReport() {
    if (!selected) return;
    try {
      const res = await fetch(`${API}/analyst/report/${selected.app_id}`, {
        method: "GET",
        headers: { ...authHeader() },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Report failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CreditAI_Report_${selected.app_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast("Report downloaded.");
    } catch (e) {
      alert(e.message || "Report failed");
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    window.location.assign("/login");
  }

  // ---- Reports view
  function ReportsView() {
    const [apps, setApps] = useState([]);
    const [loadingList, setLoadingList] = useState(false);

    useEffect(() => {
      (async () => {
        setLoadingList(true);
        try {
          const res = await fetch(`${API}/analyst/reports`, {
            headers: authHeader(),
          });
          if (res.ok) {
            const data = await res.json();
            setApps(Array.isArray(data) ? data : []);
          }
        } finally {
          setLoadingList(false);
        }
      })();
    }, []);

    return (
      <div className="an-content">
        <div className="an-page-header">
          <h1 className="an-page-title">Reports</h1>
          <p className="an-page-subtitle">
            Download PDF reports for any recent application
          </p>
        </div>

        <div className="an-card">
          <table className="an-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingList && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loadingList && apps.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    No reports yet.
                  </td>
                </tr>
              )}
              {apps.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.applicant?.full_name || "—"}</td>
                  <td>{fmtAmt(r.amount)}</td>
                  <td>{new Date(r.submitted_at).toLocaleString()}</td>
                  <td>
                    <a
                      className="an-btn"
                      href={`${API}/analyst/report/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        downloadReportFromList(r.id);
                      }}
                    >
                      Download PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  async function downloadReportFromList(appId) {
    try {
      const res = await fetch(`${API}/analyst/report/${appId}`, {
        method: "GET",
        headers: { ...authHeader() },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Report failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CreditAI_Report_${appId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || "Report failed");
    }
  }

  return (
    <div className={`analyst-scope theme-${theme}`}>
      {/* NAVBAR */}
      <div className="an-navbar">
        <div className="an-logo">CreditAI</div>
        <div className="an-nav-items">
          <button
            className="an-theme-toggle"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "🌙 Dark" : "🌞 Light"}
          </button>
          <div className="an-user-profile">
            <span className="an-user-name">Analyst</span>
            <div className="an-avatar">AN</div>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="an-sidebar">
        <button
          className={`an-sidebar-item ${
            view === "dashboard" ? "active" : ""
          }`}
          onClick={() => setView("dashboard")}
        >
          📊 Dashboard
        </button>
        <button className="an-sidebar-item" onClick={() => setView("reports")}>
          📑 Reports
        </button>
        <button className="an-sidebar-item" onClick={logout}>
          🚪 Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="an-main">
        {/* 🔔 Popup toast (top-right, coloured box) */}
        {toast && (
          <div
            className="an-alert an-alert-ok"
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 1000,
              minWidth: 260,
              padding: "10px 16px",
              borderRadius: 8,
              background: "var(--an-ok-bg, #e6ffed)",
              color: "var(--an-ok-text, #055c1a)",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            {toast}
          </div>
        )}

        {view === "dashboard" && (
          <div className="an-content">
            <div className="an-page-header">
              <h1 className="an-page-title">Loan Officer Dashboard</h1>
              <p className="an-page-subtitle">
                Review and process loan applications
              </p>
              <div>
                <button className="an-btn" onClick={() => setView("reports")}>
                  Open Reports
                </button>
              </div>
            </div>

            {err && (
              <div
                className="an-alert an-alert-warn"
                style={{ marginBottom: 12 }}
              >
                {err}
              </div>
            )}

            <div className="an-stats-grid">
              <div className="an-stat-card">
                <div className="an-stat-value an-warn">
                  {summary.pending_reviews ?? kpis.pending}
                </div>
                <div className="an-stat-label">Pending Reviews</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-value an-good">
                  {kpis.approved}
                </div>
                <div className="an-stat-label">Approved Applications</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-value an-bad">
                  {kpis.declined}
                </div>
                <div className="an-stat-label">Declined Applications</div>
              </div>
            </div>

            <div className="an-card">
              <div className="an-card-header">
                <h3 className="an-card-title">Recent Applications</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="an-btn"
                    onClick={() => {
                      loadPriority();
                      loadSummary();
                    }}
                    disabled={loading || !hasToken()}
                  >
                    {loading ? "Refreshing…" : "Refresh"}
                  </button>
                  <button
                    className="an-btn an-btn-primary"
                    onClick={() => setView("reports")}
                  >
                    Reports
                  </button>
                </div>
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
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--an-muted)",
                        }}
                      >
                        {hasToken()
                          ? "No applications found."
                          : "Please sign in to view applications."}
                      </td>
                    </tr>
                  )}

                  {rows.map((row) => (
                    <tr key={row.app_id}>
                      <td>{row.app_id}</td>
                      <td>{row.name}</td>
                      <td>{fmtAmt(row.amount)}</td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: riskColor(row.risk),
                        }}
                      >
                        {row.risk == null ? "—" : row.risk.toFixed(2)}
                      </td>
                      <td>
                        {row.confidence == null
                          ? "—"
                          : `${(row.confidence * 100).toFixed(1)}%`}
                      </td>
                      <td>
                        <span
                          className={`an-badge ${badgeClass(row.status)}`}
                        >
                          {row.status || "pending"}
                        </span>
                      </td>
                      <td
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="an-btn an-btn-primary"
                          onClick={() => analyzeRow(row)}
                          disabled={!hasToken()}
                        >
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {modal.open && (
              <div
                className="modal-backdrop"
                onClick={() =>
                  setModal({
                    open: false,
                    app_id: null,
                    current: "pending",
                  })
                }
              >
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Update Decision</h3>
                  <p className="muted">
                    Status changes are controlled on the analysis page.
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="an-btn"
                      onClick={() =>
                        setModal({
                          open: false,
                          app_id: null,
                          current: "pending",
                        })
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "reports" && <ReportsView />}

        {/* REVIEW / ANALYZE */}
        {view === "review" && (
          <div className="an-content">
            <div className="an-page-header">
              <h1 className="an-page-title">
                Application Analysis: {selected ? selected.app_id : "—"}
              </h1>
              <p className="an-page-subtitle">
                {selected
                  ? `${selected.name} — ${fmtAmt(selected.amount)}`
                  : ""}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="an-btn"
                  onClick={() => setView("dashboard")}
                >
                  ← Back
                </button>
                <button className="an-btn" onClick={() => setView("reports")}>
                  Open Reports
                </button>
              </div>
            </div>

            {explErr && (
              <div
                className="an-alert an-alert-warn"
                style={{ marginBottom: 12 }}
              >
                {explErr}
              </div>
            )}

            <div className="an-card">
              <div className="an-risk-banner">
                <div className="score">
                  {score == null
                    ? loadingExpl
                      ? "…"
                      : selected?.risk == null
                      ? "—"
                      : selected.risk.toFixed(2)
                    : score.toFixed(2)}
                </div>
                <div
                  className="level"
                  style={{ color: riskColor(score ?? selected?.risk) }}
                >
                  {(score ?? selected?.risk) != null &&
                  (score ?? selected?.risk) >= 0.6
                    ? "HIGH RISK"
                    : "LOW/MED RISK"}
                </div>
                <div className="meta">
                  Model Probability (risky):{" "}
                  {score == null ? "—" : `${(score * 100).toFixed(1)}%`} | XGBoost
                </div>
              </div>

              <h3 className="an-section-title">AI Explanation Comparison</h3>

              <div className="an-two-col">
                <div className="an-expl shap">
                  <div className="head">
                    <h4>SHAP Analysis</h4>
                    <span className="chip blue">
                      {speed.shap_ms != null ? `${speed.shap_ms} ms` : "—"}
                    </span>
                  </div>
                  {!shap && (
                    <div className="placeholder">
                      {loadingExpl ? "Loading SHAP…" : "SHAP Waterfall Chart"}
                    </div>
                  )}
                  {shap && (
                    <>
                      <TopBars pairs={topByAbs(shap.contributions, 8)} />
                      {shap.error && (
                        <div className="an-alert an-alert-warn">
                          {shap.error}
                        </div>
                      )}
                    </>
                  )}
                  <div className="meta-box">
                    <b>Note:</b> Positive weight pushes risk up; negative pushes
                    risk down.
                  </div>
                </div>

                <div className="an-expl lime">
                  <div className="head">
                    <h4>LIME Analysis</h4>
                    <span className="chip green">
                      {speed.lime_ms != null ? `${speed.lime_ms} ms` : "—"}
                    </span>
                  </div>
                  {!lime && (
                    <div className="placeholder">
                      {loadingExpl ? "Loading LIME…" : "LIME Local Explanation"}
                    </div>
                  )}
                  {lime && (
                    <>
                      <TopBars pairs={topByAbs(lime.contributions, 8)} />
                      {lime.error && (
                        <div className="an-alert an-alert-warn">
                          {lime.error}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {shap && lime && (
                <div className="an-card soft">
                  <h4>SHAP vs LIME — Differences</h4>
                  {(() => {
                    const s = Object.fromEntries(
                      (shap.contributions || []).map((p) => [
                        p.feature,
                        Number(p.weight),
                      ])
                    );
                    const l = Object.fromEntries(
                      (lime.contributions || []).map((p) => [
                        p.feature,
                        Number(p.weight),
                      ])
                    );
                    const feats = Array.from(
                      new Set([...Object.keys(s), ...Object.keys(l)])
                    );
                    const diffs = feats
                      .map((f) => ({
                        feature: f,
                        shap: s[f] ?? 0,
                        lime: l[f] ?? 0,
                        delta: (s[f] ?? 0) - (l[f] ?? 0),
                      }))
                      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                      .slice(0, 8);
                    return (
                      <table className="an-table">
                        <thead>
                          <tr>
                            <th>Feature</th>
                            <th>SHAP</th>
                            <th>LIME</th>
                            <th>Δ (SHAP − LIME)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffs.map((d, i) => (
                            <tr key={i}>
                              <td>{d.feature}</td>
                              <td
                                style={{
                                  color:
                                    d.shap >= 0
                                      ? "var(--an-danger)"
                                      : "var(--an-good)",
                                }}
                              >
                                {d.shap.toFixed(2)}
                              </td>
                              <td
                                style={{
                                  color:
                                    d.lime >= 0
                                      ? "var(--an-danger)"
                                      : "var(--an-good)",
                                }}
                              >
                                {d.lime.toFixed(2)}
                              </td>
                              <td
                                style={{
                                  fontWeight: 700,
                                  color:
                                    Math.abs(d.delta) >= 0.15
                                      ? "var(--an-warn)"
                                      : "var(--an-muted)",
                                }}
                              >
                                {(d.delta >= 0 ? "+" : "") +
                                  d.delta.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}

              <div className="an-card soft">
                <h4>Actions</h4>
                <div
                  className="an-actions center"
                  style={{ gap: 8, flexWrap: "wrap" }}
                >
                  <button
                    className="an-btn an-btn-primary"
                    disabled={!selected}
                    onClick={() =>
                      selected &&
                      setQuickDecision(selected.app_id, "approved")
                    }
                  >
                    Approve Application
                  </button>
                  <button
                    className="an-btn"
                    disabled={!selected}
                    onClick={() =>
                      selected &&
                      setQuickDecision(selected.app_id, "declined")
                    }
                  >
                    Decline Application
                  </button>
                  <button
                    className="an-btn"
                    disabled={!selected}
                    onClick={() =>
                      selected &&
                      setQuickDecision(selected.app_id, "manual_review")
                    }
                  >
                    Mark for Review
                  </button>
                  <button className="an-btn" onClick={downloadReport}>
                    Download Report (PDF)
                  </button>
                  <button
                    className="an-btn"
                    onClick={() => setView("reports")}
                  >
                    Open Reports
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
