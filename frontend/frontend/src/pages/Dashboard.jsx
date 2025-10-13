import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import logo from "../assets/react.svg"; // replace with your logo

export default function Dashboard() {
  const nav = useNavigate();
  return (
    <div className="dashboard-container">
      <img src={logo} alt="Logo" className="dashboard-logo" />
      <h1 className="dashboard-title">Explainable Financial AI</h1>
      <p className="dashboard-text">
        A transparent platform for financial risk assessment and AI explainability.
        Get started to explore secure, data-driven insights.
      </p>
      <button className="get-started-btn" onClick={() => nav("/login")}>
        Get Started
      </button>
    </div>
  );
}
