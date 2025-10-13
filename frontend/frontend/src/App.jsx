import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing / Dashboard page */}
        <Route path="/" element={<Dashboard />} />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Fallback route */}
        <Route
          path="*"
          element={
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
              <h1 className="text-3xl font-bold mb-6">Page Not Found</h1>
              <Link
                to="/"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Go Home
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
