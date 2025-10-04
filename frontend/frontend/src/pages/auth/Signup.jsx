import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
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
      alert("Registration successful!");
      nav("/login");
    } else {
      alert(data.detail || "Signup failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <form onSubmit={handleSignup} className="bg-white shadow-lg rounded-lg p-6 w-80">
        <h2 className="text-2xl font-semibold mb-4 text-center">Sign Up</h2>
        <input
          type="email"
          placeholder="Email"
          className="border w-full p-2 mb-3 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="border w-full p-2 mb-3 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border w-full p-2 mb-3 rounded"
        >
          <option value="user">User</option>
          <option value="officer">Officer</option>
          <option value="admin">Admin</option>
        </select>
        <button className="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">
          Sign Up
        </button>
        <a href="/login" className="block text-center text-sm mt-3 text-blue-600 underline">
          Already have an account? Login
        </a>
      </form>
    </div>
  );
}
