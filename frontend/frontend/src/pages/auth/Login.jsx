// src/pages/auth/Login.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/auth.css";

const API_BASE = "http://127.0.0.1:8000";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Robust base64url decoder (handles padding)
  const decodeJwt = (token) => {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      let base64 = part.replace(/-/g, "+").replace(/_/g, "/");
      // pad with '=' to length multiple of 4
      while (base64.length % 4 !== 0) base64 += "=";
      const json = atob(base64);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

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

  // If already logged in, bounce to the correct dashboard immediately
  useEffect(() => {
    const existing = localStorage.getItem("access_token");
    if (!existing) return;
    const p = decodeJwt(existing);
    const role = (p?.role || p?.data?.role || p?.claims?.role || "").toLowerCase();
    const target = routeByRole(role);
    if (target) {
      // Use hard redirect to avoid any guard/state edge cases
      window.location.replace(target);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      // 1) Success: got a token immediately (seed-bypass or flows that return token)
      if (res.ok && data.access_token) {
        const token = data.access_token;
        localStorage.setItem("access_token", token);

        const payload = decodeJwt(token);
        const role =
          (payload?.role || payload?.data?.role || payload?.claims?.role || "").toLowerCase();
        const userEmail = payload?.email || payload?.data?.email || email;

        if (role) localStorage.setItem("role", role);
        if (userEmail) localStorage.setItem("email", userEmail);

        const target = routeByRole(role);
        window.location.replace(target);
        return;
      }

      // 2) 2FA required: route to the TwoFactor screen
      if (res.ok && data.twofa_required) {
        localStorage.setItem("email", email);
        // TwoFactor will complete auth and then hard-redirect
        nav("/twofa");
        return;
      }

      // 3) Typical errors
      if (res.status === 403) {
        // pending approval, etc.
        localStorage.setItem("email", email);
        nav("/pending-approval");
        return;
      }
      if (res.status === 401) {
        alert(data.detail || "Invalid credentials.");
        return;
      }

      // Fallback
      alert(data.detail || "Unexpected response from server.");
    } catch (err) {
      console.error(err);
      alert("Network error. Is the API running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-container">
        <div className="auth-logo">CreditAI</div>
        <p className="auth-subtitle">Explainable Loan Risk Assessment System</p>

        <div className="auth-tabs">
          <button className="auth-tab active">Sign In</button>
          <button className="auth-tab" onClick={() => nav("/signup")}>
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleLogin} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="john.doe@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="auth-actions">
            <label className="auth-remember">
              <input type="checkbox" /> Remember me
            </label>
            <Link className="auth-forgot" to="/request-reset">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="divider"><span>or</span></div>

        <button
          type="button"
          className="btn btn-google"
          onClick={() =>
            (window.location.href = `${API_BASE}/auth/google`)
          }
        >
          <img
            alt="Google"
            width="18"
            height="18"
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          />
          Continue with Google
        </button>

        <div className="auth-bottom-text">
          Don’t have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
