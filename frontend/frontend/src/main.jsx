// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import RequestReset from "./pages/auth/RequestReset";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import AnalystDashboard from "./pages/analyst/AnalystDashboard";
import AnalystReview from "./pages/analyst/AnalystReview";
import RegulatorDashboard from "./pages/regulator/RegulatorDashboard";

import RoleGuard from "./components/RoleGuard"; 

import "./styles/theme.css";
import "./index.css";

function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Auth Demo</h1>
      <div className="space-x-4">
        <Link to="/login" className="px-4 py-2 bg-blue-600 text-white rounded">Login</Link>
        <Link to="/signup" className="px-4 py-2 bg-green-600 text-white rounded">Signup</Link>
        <Link to="/request-reset" className="px-4 py-2 bg-gray-800 text-white rounded">Forgot Password</Link>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/app" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/request-reset" element={<RequestReset />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected dashboards by role */}
        <Route
          path="/admin"
          element={
            <RoleGuard allow={["admin"]}>
              <AdminDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/customer"
          element={
            <RoleGuard allow={["customer"]}>
              <CustomerDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/analyst"
          element={
            <RoleGuard allow={["analyst"]}>
              <AnalystDashboard />
            </RoleGuard>
          }
        />
        {/* Optional: guard AnalystReview too */}
        <Route
          path="/analyst/review/:id"
          element={
            <RoleGuard allow={["analyst"]}>
              <AnalystReview />
            </RoleGuard>
          }
        />
        <Route
          path="/regulator"
          element={
            <RoleGuard allow={["regulator"]}>
              <RegulatorDashboard />
            </RoleGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
