//frontend\frontend\src\pages\auth\ResetPassword.jsx
import React, { useState, useEffect } from "react";
import "../../styles/resetpassword.css";

const API_BASE = "http://127.0.0.1:8000";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!token) {
      setMessage("Missing or invalid reset token.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (!res.ok) {
        throw new Error(data.detail || "Error resetting password");
      }

      setMessage(data.msg || "Password reset successful! Redirecting to login…");
      // redirect to login shortly (prevents loading /customer without auth)
      setTimeout(() => window.location.assign("/login"), 1200);
    } catch (err) {
      setMessage(err.message || "Error resetting password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="resetpw-overlay">
      <div className="resetpw-container">
        <h2 className="resetpw-title">Reset Password</h2>
        <p className="resetpw-subtitle">
          Enter and confirm your new password below.
        </p>

        {!token && (
          <p className="resetpw-message" style={{ color: "tomato", marginBottom: 12 }}>
            The reset link is missing a token. Please request a new password reset.
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="resetpw-input"
            required
          />

          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="resetpw-input"
            required
          />

          <button type="submit" className="resetpw-button" disabled={busy || !token}>
            {busy ? "Resetting…" : "Reset Password"}
          </button>

          {message && <p className="resetpw-message">{message}</p>}
        </form>
      </div>
    </div>
  );
}

