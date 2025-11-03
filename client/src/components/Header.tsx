// src/components/Header.tsx
import React from "react";
import { useAuth } from "../auth/AuthContext";

const Header: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => {
  const { user, logout } = useAuth();
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
      <div>
        <h1 className="text-base font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-400">
          {user?.username} • {user?.role}
        </span>
        <button
          onClick={logout}
          className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
        >
          خروج
        </button>
      </div>
    </header>
  );
};

export default Header;
