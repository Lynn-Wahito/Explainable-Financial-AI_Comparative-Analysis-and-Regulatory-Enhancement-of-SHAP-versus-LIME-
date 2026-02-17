// src/pages/Dashboard.jsx
import React from "react";
import "../styles/dashboard.css";
import reactLogo from "../assets/react.svg"; // keep your current logo path

export default function Dashboard() {
  const onGetStarted = () => {
    window.location.href = "/signup"; // or use useNavigate()
  };

  const onSignIn = () => {
    window.location.href = "/login";
  };

  return (
    <div className="dashboard-page">
      {/* HERO (your original content, untouched) */}
      <div className="dashboard-container">
        <img
          src={reactLogo}
          className="dashboard-logo"
          alt="Logo"
          aria-hidden="true"
        />
        <h1 className="dashboard-title">Transparent Loan Risk Assessment</h1>
        <p className="dashboard-text">
          Advanced machine learning with SHAP and LIME explanations for
          trustworthy, accountable financial decision-making
        </p>

        <button className="get-started-btn" onClick={onGetStarted}>
          Get Started
        </button>
      </div>

      {/* FEATURES SECTION (new) */}
      <section className="features-wrap">
        <div className="features-inner">
          <div className="features-head">
            <h2 className="features-title">Why Explainable AI Matters</h2>
            <p className="features-sub">
              Breaking through the “black box” with transparent, interpretable
              model insights
            </p>
          </div>

          <div className="features-grid">
            {/* Card 1 */}
            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🛡️</div>
              <div className="feature-card-head">
                <h3>Trustworthy Decisions</h3>
                <p>
                  SHAP and LIME explanations provide clear insights into model
                  predictions.
                </p>
              </div>
              <ul className="feature-list">
                <li>Feature importance visualization</li>
                <li>Consistent interpretation methods</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="feature-card">
              <div className="feature-icon" aria-hidden>📊</div>
              <div className="feature-card-head">
                <h3>Comparative Analysis</h3>
                <p>
                  Side-by-side comparison of SHAP and LIME explanation
                  techniques.
                </p>
              </div>
              <ul className="feature-list">
                <li>Stability and consistency metrics</li>
                <li>Clarity assessment</li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="feature-card">
              <div className="feature-icon" aria-hidden>👥</div>
              <div className="feature-card-head">
                <h3>Equitable Access</h3>
                <p>
                  Promoting fairness and accountability in AI-driven financial
                  services.
                </p>
              </div>
              <ul className="feature-list">
                <li>Transparent risk assessment</li>
                <li>Standardized explanations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION (new) */}
      <section className="cta-wrap">
        <div className="cta-inner">
          <h3 className="cta-title">Ready to Experience Transparent AI?</h3>
          <p className="cta-sub">Sign in to access the platform</p>
          <button className="cta-btn" onClick={onSignIn}>
            Sign In to Get Started
          </button>
        </div>
      </section>

      {/* FOOTER (new) */}
      <footer className="landing-footer">
        <div className="footer-inner">
          © 2025 XAI Loan Assessment. Enhancing trust through explainability.
        </div>
      </footer>
    </div>
  );
}
