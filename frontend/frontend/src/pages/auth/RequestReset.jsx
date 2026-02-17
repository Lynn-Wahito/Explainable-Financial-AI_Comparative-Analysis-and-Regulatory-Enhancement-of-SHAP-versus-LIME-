//frontend\frontend\src\pages\auth\RequestReset.jsx
import { useState } from "react";
import "../../styles/requestreset.css";

const API_BASE = "http://127.0.0.1:8000";

export default function RequestReset() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/auth/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Try parse JSON; if parsing fails, create a default object
      let d = {};
      try { d = await r.json(); } catch (_) {}

      if (!r.ok) {
        throw new Error(d.detail || "Failed to request password reset.");
      }

      setMsg(d.msg || "If that email exists, a reset link was sent.");
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reset-overlay">
      <div className="reset-container">
        <h2 className="reset-title">Password Reset</h2>
        <p className="reset-subtitle">
          Enter your email address to receive a password reset link.
        </p>

        <form onSubmit={handle} className="reset-form" noValidate>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="reset-input"
            required
          />

          <button type="submit" className="reset-button" disabled={busy}>
            {busy ? "Sending…" : "Send Reset Link"}
          </button>

          {msg && <p className="reset-message">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
