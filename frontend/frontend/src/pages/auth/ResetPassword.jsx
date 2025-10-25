import React, { useState, useEffect } from "react";
import "../../styles/resetpassword.css";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    try {
      const res = await fetch("http://127.0.0.1:8000/auth/complete-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      setMessage(data.detail || "Password reset successful!");
    } catch (err) {
      setMessage("Error resetting password");
    }
  };

  return (
    <div className="resetpw-overlay">
      <div className="resetpw-container">
        <h2 className="resetpw-title">Reset Password</h2>
        <p className="resetpw-subtitle">
          Enter and confirm your new password below.
        </p>

        <form onSubmit={handleSubmit}>
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

          <button type="submit" className="resetpw-button">
            Reset Password
          </button>

          {message && <p className="resetpw-message">{message}</p>}
        </form>
      </div>
    </div>
  );
}
