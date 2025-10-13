import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch("http://127.0.0.1:8000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok && data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      nav("/dashboard");
    } else {
      alert(data.detail || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Welcome</h2>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                required
                placeholder=" "
                onChange={(e) => setEmail(e.target.value)}
              />
              <label htmlFor="email">Email Address</label>
              <span className="focus-border"></span>
            </div>
          </div>

          <div className="form-group">
            <div className="input-wrapper password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                required
                placeholder=" "
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="password">Password</label>

              {/* Toggle Eye Button */}
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle Password Visibility" 
                >
                    <span className={`eye-icon ${showPassword ? "show-password" : ""}`}></span>
                </button>
              <span className="focus-border"></span>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-wrapper">
              <input type="checkbox" />
              <span className="checkbox-label">
                <span className="checkmark"></span> Remember me
              </span>
            </label>

            <Link to="/request-reset" className="forgot-password">
              Forgot password?
            </Link>

          </div>

          <button type="submit" className="btn login-btn">
            <span className="btn-text">Sign In</span>
            <span className="btn-loader"></span>
          </button>
        </form>

        <div className="divider"><span>or continue with</span></div>

        <div className="social-login">
          <button type="button" className="social-btn">
            <span className="social-icon google-icon"></span> Google
          </button>
        </div>

        <div className="signup-link">
          <p>Don't have an account? <a href="/signup">Sign up</a></p>
        </div>
      </div>
    </div>
  );
}
