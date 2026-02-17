import React from "react";
import "../../styles/PendingApproval.css";

export default function PendingApproval({ email, onContact }) {
  return (
    <div className="pending-wrap">
      <div className="pending-card">
        <div className="pending-logo">CreditAI</div>
        <div className="pending-subtitle">Account Status</div>

        <div className="pending-badge">Pending Approval</div>

        <h3 className="pending-title">Your account is under review</h3>
        <p className="pending-desc">
          Thank you for signing up. Our administrator will assign your role
          and activate your account within <strong>24–48 hours</strong>.
          You’ll receive an email at <strong>{email || "your email"}</strong>
          once it’s ready.
        </p>

        <div className="pending-divider" />

        <p className="pending-hint">
          Need urgent access? Contact your organization admin or support.
        </p>

        <button className="btn-contact" onClick={onContact}>
          Contact Support
        </button>
      </div>
    </div>
  );
}
