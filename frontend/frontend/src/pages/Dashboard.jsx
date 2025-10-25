// src/pages/Dashboard.jsx
import React from "react";
import "../styles/dashboard.css";
import reactLogo from "../assets/react.svg"; // or your own logo path

export default function Dashboard() {
  const onGetStarted = () => {
    window.location.href = "/signup"; // or use useNavigate()
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <img
          src={reactLogo}
          className="dashboard-logo"
          alt="Logo"
          aria-hidden="true"
        />
        <h1 className="dashboard-title">Explainable Financial AI</h1>
        <p className="dashboard-text">
          A transparent platform for financial risk assessment and AI
          explainability. Get started to explore secure, data-driven insights.
        </p>

        <button className="get-started-btn" onClick={onGetStarted}>
          Get Started
        </button>
      </div>
    </div>
  );
}
