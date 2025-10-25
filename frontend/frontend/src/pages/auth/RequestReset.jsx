import { useState } from "react";
import "../../styles/requestreset.css";

export default function RequestReset() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    const r = await fetch("http://127.0.0.1:8000/auth/request-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await r.json();
    setMsg(d.msg || "If that email exists, a reset link was sent.");
  };

  return (
    <div className="reset-overlay">
      <div className="reset-container">
        <h2 className="reset-title">Password Reset</h2>
        <p className="reset-subtitle">
          Enter your email address to receive a password reset link.
        </p>

        <form onSubmit={handle} className="reset-form">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="reset-input"
            required
          />

          <button type="submit" className="reset-button">
            Send Reset Link
          </button>

          {msg && <p className="reset-message">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
