// src/pages/auth/Provision2FA.jsx
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";

export default function Provision2FA() {
  const nav = useNavigate();
  const email = localStorage.getItem("email");
  const token = localStorage.getItem("access_token"); // may be absent if you require 2FA before token; ok for provision if you want it open
  const [loading, setLoading] = useState(true);
  const [uri, setUri] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function loadProvision() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/auth/2fa/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Provision failed");
      setUri(json.otpauth_uri);
      setSecret(json.secret);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmOnce() {
    // Optional: have the user type one code to confirm pairing
    try {
      setError("");
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Verification failed");
      localStorage.setItem("access_token", json.access_token);
      // route by role if you wish; here we just go to dashboard
      nav("/dashboard");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (!email) {
      nav("/login");
      return;
    }
    loadProvision();
  }, []);

  return (
    <div className="auth-overlay">
      <div className="auth-container" style={{ maxWidth: 520 }}>
        <div className="auth-logo">CreditAI</div>
        <p className="auth-subtitle">Set up your Authenticator</p>

        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <p style={{ color: "crimson" }}>{error}</p>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <QRCodeCanvas value={uri} size={200} />
            </div>
            <p style={{ textAlign: "center", color: "var(--muted)" }}>
              Scan this QR in Google Authenticator (or enter secret manually):<br />
              <code style={{ userSelect: "all" }}>{secret}</code>
            </p>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label" htmlFor="code">Enter 6-digit code to confirm</label>
              <input
                id="code"
                className="form-input"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>

            <button className="btn btn-primary" onClick={confirmOnce}>Confirm & Continue</button>
          </>
        )}
      </div>
    </div>
  );
}
