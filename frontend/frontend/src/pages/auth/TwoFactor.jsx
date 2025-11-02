// src/pages/auth/TwoFactor.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

function decodeJwt(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    let base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function TwoFactor() {
  const nav = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem("email") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // if we somehow land here without an email, send back to login
  useEffect(() => {
    if (!email) nav("/login");
  }, [email, nav]);

  const routeByRole = (role) => {
    const r = (role || "").toLowerCase();
    const map = {
      customer: "/customer",
      analyst: "/analyst",
      regulator: "/regulator",
      admin: "/admin",
    };
    return map[r] || "/dashboard";
  };

  async function verify(e) {
    e.preventDefault();
    if (!email) return alert("Missing email context. Please sign in again.");
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Invalid or expired code");

      // save token
      localStorage.setItem("access_token", json.access_token);

      // decode role + email for routing
      const payload = decodeJwt(json.access_token) || {};
      const role = (payload?.role || payload?.data?.role || payload?.claims?.role || "").toLowerCase();
      const userEmail = payload?.email || payload?.data?.email || email;

      if (role) localStorage.setItem("role", role);
      if (userEmail) localStorage.setItem("email", userEmail);

      const target = routeByRole(role);
      // Hard redirect so guards/state cannot interfere
      window.location.replace(target);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-container">
        <div className="auth-logo">CreditAI</div>
        <p className="auth-subtitle">Two-Factor Authentication</p>

        <form className="auth-form" onSubmit={verify} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              className="form-input"
              type="text"
              inputMode="numeric"
              pattern="^[0-9]{6}$"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              autoFocus
              required
            />
          </div>

        <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || code.length !== 6}
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>

        <p className="auth-bottom-text" style={{ marginTop: 12 }}>
          Don’t have the app set up yet?{" "}
          <Link to="/provision-2fa">Provision 2FA</Link>
        </p>
      </div>
    </div>
  );
}
