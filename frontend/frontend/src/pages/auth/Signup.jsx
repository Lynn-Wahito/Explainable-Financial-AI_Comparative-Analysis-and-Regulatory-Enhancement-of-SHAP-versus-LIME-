import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/auth.css";

export default function Signup() {
  const nav = useNavigate();
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);

  async function handleSignup(e) {
  e.preventDefault();

  if (!fullName.trim()) return alert("Please enter your full name.");
  if (password !== confirm) return alert("Passwords do not match.");

  setLoading(true);
  try {
    const resp = await fetch("http://127.0.0.1:8000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim(),     // <-- send full_name (backend expects this)
        // If you keep the alias change above, sending fullName also works:
        // fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirm_password: confirm,
      }),
    });

    let data;
    try {
      data = await resp.json();    // parse body once
    } catch {
      data = {};
    }

    if (resp.ok) {
      alert(data.message || "Account created. Pending admin approval.");
      // optional: pass email in state
      nav("/pending-approval", { state: { email: email.trim() } });
    } else {
      console.error("Register error payload:", data);
      const msg =
        (Array.isArray(data?.detail) && data.detail[0]?.msg) || // pydantic error format
        data?.detail ||
        data?.message ||
        "Signup failed. Please check your details.";
      alert(msg);
    }
  } catch (err) {
    console.error(err);
    alert("Network error. Is the API running?");
  } finally {
    setLoading(false);
  }
}

  return (
    <div className="auth-overlay">
      <div className="auth-container">
        <div className="auth-logo">CreditAI</div>
        <p className="auth-subtitle">Explainable Loan Risk Assessment System</p>

        <div className="auth-tabs">
          <button className="auth-tab" onClick={() => nav("/login")}>
            Sign In
          </button>
          <button className="auth-tab active">Sign Up</button>
        </div>

        <form className="auth-form" onSubmit={handleSignup} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              className="form-input"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

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
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirm">Confirm Password</label>
            <input
              id="confirm"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="auth-bottom-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
