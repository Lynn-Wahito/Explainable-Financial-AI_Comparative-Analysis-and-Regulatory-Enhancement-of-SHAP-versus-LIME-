// src/components/RoleGuard.jsx
import { Navigate } from "react-router-dom";

export default function RoleGuard({ allow = [], children }) {
  const token = localStorage.getItem("access_token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (allow.length && !allow.includes(role)) return <Navigate to="/login" replace />;

  return children;
}
