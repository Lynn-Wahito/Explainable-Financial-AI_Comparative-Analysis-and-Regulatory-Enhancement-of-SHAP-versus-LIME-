// src/pages/auth/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/auth.css";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Decode JWT payload safely
  const decodeJwt = (token) => {
    try {
      const base64 = token.split(".")[1];
      const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch (e) {
      console.error("Failed to decode token", e);
      return null;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.access_token) {
        const token = data.access_token;
        localStorage.setItem("access_token", token);

        // Read role/email from token (your backend sets data.role)
        const payload = decodeJwt(token);
        const role =
          payload?.role || payload?.data?.role || payload?.claims?.role || null;
        const userEmail = payload?.email || payload?.data?.email || email;

        if (role) localStorage.setItem("role", role);
        if (userEmail) localStorage.setItem("email", userEmail);

        // Role → Route map
        const routeByRole = {
          customer: "/customer",
          analyst: "/analyst",
          regulator: "/regulator",
          admin: "/admin",
        };

        // Redirect based on role (fallback to /dashboard)
        nav(routeByRole[role] || "/dashboard");
      } else {
        alert(data.detail || "Login failed");
      }
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

        {/* Google ONLY on Login */}
        <button
          type="button"
          className="btn btn-google"
          onClick={() =>
            (window.location.href = "http://127.0.0.1:8000/auth/google")
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
