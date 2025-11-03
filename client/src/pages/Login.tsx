// src/pages/Login.tsx
import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("user@smartcar.local");
  const [password, setPassword] = useState("user123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || "فشل تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md p-6 border shadow-xl bg-slate-900/60 border-slate-700 rounded-xl">
        <h1 className="mb-2 text-2xl font-bold">تسجيل الدخول</h1>
        <p className="mb-4 text-sm text-slate-400">دخول مخصص للتحكم والبث</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm">البريد الإلكتروني</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-slate-950/30 border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              type="email"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm">كلمة المرور</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-slate-950/30 border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              type="password"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            disabled={busy}
            className="w-full py-2 font-semibold transition bg-teal-500 rounded-lg hover:bg-teal-400 text-slate-950"
          >
            {busy ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          اذا ما عندك حساب تواصل مع الادمن.
        </p>
      </div>
    </div>
  );
};

export default Login;
