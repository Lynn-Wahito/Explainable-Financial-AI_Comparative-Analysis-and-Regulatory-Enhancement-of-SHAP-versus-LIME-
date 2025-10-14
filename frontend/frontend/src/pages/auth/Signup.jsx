import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/signup.css"; // same folder style as login.css

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const nav = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    const res = await fetch("http://127.0.0.1:8000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Registration successful!");
      nav("/login");
    } else {
      alert(data.detail || "Signup failed. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Create Account</h2>
          <p>Sign up to get started</p>
        </div>

        <form onSubmit={handleSignup} className="login-form" id="signupForm">
          <div className="form-group">
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="email">Email Address</label>
              <span className="focus-border"></span>
            </div>
          </div>

          <div className="form-group">
            <div className="input-wrapper password-wrapper">
              <input
                type="password"
                id="password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="password">Password</label>
              <span className="focus-border"></span>
            </div>
          </div>

          <button type="submit" className="login-btn btn">
            <span className="btn-text">Sign Up</span>
            <span className="btn-loader"></span>
          </button>
        </form>

        <div className="divider">
          <span>or continue with</span>
        </div>

        <div className="social-login">
          <button
            type="button"
            className="social-btn google-btn"
            onClick={() =>
              (window.location.href = "http://127.0.0.1:8000/auth/google")
            }
          >
            <span className="social-icon google-icon"></span>
            Continue with Google
          </button>
        </div>

        <div className="signup-link">
          <p>
            Already have an account?{" "}
            <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
