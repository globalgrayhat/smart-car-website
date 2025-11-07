/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Header
 *
 * - Shows current page title and subtitle.
 * - Displays authenticated user info and logout.
 * - On mobile: provides a burger button to toggle the sidebar via "sidebar:toggle" event.
 */

import React from "react";
import { useAuth } from "../auth/AuthContext";

type HeaderProps = {
  title: string;
  subtitle?: string;
};

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user, logout } = useAuth();

  /**
   * Trigger global sidebar toggle event (used by Sidebar on mobile).
   */
  const toggleSidebar = () => {
    window.dispatchEvent(new Event("sidebar:toggle"));
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
      {/* Left side: burger (mobile) + titles */}
      <div className="flex items-center gap-3">
        {/* Burger menu button - visible on small screens only */}
        <button
          onClick={toggleSidebar}
          className="inline-flex items-center justify-center rounded-lg w-9 h-9 bg-slate-900/80 text-slate-200 hover:bg-slate-800 md:hidden"
          aria-label="فتح القائمة الجانبية"
        >
          <span className="flex flex-col items-center justify-center gap-[4px] w-5">
            <span className="w-full h-[2px] rounded bg-slate-200" />
            <span className="w-4/5 h-[2px] rounded bg-slate-300" />
            <span className="w-3/5 h-[2px] rounded bg-slate-400" />
          </span>
        </button>

        <div>
          <h1 className="text-base font-semibold text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side: user info + logout */}
      <div className="flex items-center gap-3 text-xs">
        {user && (
          <span className="hidden sm:inline-flex text-slate-400">
            {user.username} • {user.role}
          </span>
        )}
        <button
          onClick={logout}
          className="px-3 py-1 text-xs rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700"
        >
          خروج
        </button>
      </div>
    </header>
  );
};

export default Header;
