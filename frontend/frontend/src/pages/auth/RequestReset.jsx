import { useState } from "react";

export default function RequestReset() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    const r = await fetch("http://127.0.0.1:8000/auth/request-reset", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email })
    });
    const d = await r.json();
    setMsg(d.msg || "If that email exists, a reset link was sent.");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <form onSubmit={handle} className="bg-white p-6 rounded shadow w-80">
        <h2 className="text-xl mb-3 font-semibold text-center">Request Password Reset</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="border p-2 w-full mb-3 rounded"
          required
        />
        <button className="bg-blue-600 text-white w-full py-2 rounded">Send Reset Link</button>
        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      </form>
    </div>
  );
}
