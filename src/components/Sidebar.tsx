/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";

interface SidebarProps {
  current: string;
  onChange: (p: any) => void;
}

// lightweight inline icons
const NavIcon = ({
  type,
}: {
  type: "home" | "dash" | "control" | "settings";
}) => {
  const common = "w-4 h-4";
  switch (type) {
    case "home":
      return (
        <svg
          className={common}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
        >
          <path
            d="M4 10.5 12 4l8 6.5"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 9.5v9h4v-5h4v5h4v-9"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case "dash":
      return (
        <svg
          className={common}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
        >
          <rect x="4" y="4" width="6" height="6" rx="1.5" strokeWidth="1.3" />
          <rect x="14" y="4" width="6" height="4" rx="1.2" strokeWidth="1.3" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" strokeWidth="1.3" />
          <rect x="14" y="11" width="6" height="9" rx="1.5" strokeWidth="1.3" />
        </svg>
      );
    case "control":
      return (
        <svg
          className={common}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
        >
          <circle cx="12" cy="12" r="3.5" strokeWidth="1.4" />
          <path
            d="M4 12h2.5M17.5 12H20M12 4v2.5M12 17.5V20"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "settings":
    default:
      return (
        <svg
          className={common}
          viewBox="0 0 24 24"
          stroke="currentColor"
          fill="none"
        >
          <path
            d="M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m19 12-.86-.5.03-1L19 9 17.5 7.5l-1 .83-.97-.05L14.5 6h-3l-.5 1.28-.97.05-1-.83L6.5 9l.82 1-.04 1L6.5 12l1.32 2.3 1-.14.7.76-.2 1.36L11 19h2l.74-1.67-.2-1.36.7-.76 1 .14L19 12Z"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

const items = [
  { id: "home", label: "الرئيسية", icon: "home" as const },
  { id: "dashboard", label: "لوحة البث", icon: "dash" as const },
  { id: "control", label: "التحكّم", icon: "control" as const },
  { id: "settings", label: "الإعدادات", icon: "settings" as const },
];

const Sidebar: React.FC<SidebarProps> = ({ current, onChange }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  // listen for global toggle fired from Header
  useEffect(() => {
    const handler = () => {
      setMobileOpen((prev) => !prev);
    };
    window.addEventListener("sidebar:toggle", handler);
    return () => window.removeEventListener("sidebar:toggle", handler);
  }, []);

  // common render for items
  const renderItem = (item: { id: string; label: string; icon: any }) => {
    const isActive = current === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          onChange(item.id);
          setMobileOpen(false);
        }}
        className={`group relative w-full text-right px-3.5 py-2.5 text-sm flex items-center gap-2.5 rounded-xl transition-all
          ${
            isActive
              ? "bg-slate-800/70 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-900/40"
          }
        `}
      >
        {/* right side glow bar for active item */}
        {isActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-l-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
        )}
        {/* label on the right (we're RTL) */}
        <span className="flex-1 text-right">{item.label}</span>
        {/* icon on the left */}
        <span
          className={`flex items-center justify-center rounded-md p-1.5 ${
            isActive
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-slate-900/20 text-slate-300/70 group-hover:text-white"
          }`}
        >
          <NavIcon type={item.icon} />
        </span>
      </button>
    );
  };

  return (
    <>
      {/* desktop sidebar */}
      <aside className="flex-col hidden border-r md:flex md:w-58 lg:w-64 border-slate-800 bg-slate-950/40 backdrop-blur-xl">
        {/* top brand */}
        <div className="flex items-center justify-between px-4 border-b h-14 border-slate-800/70">
          <span className="text-sm font-semibold tracking-tight text-white">
            لوحة تحكم البث
          </span>
          <span className="text-[14px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/10">
            تجريبي
          </span>
        </div>

        {/* nav items */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {items.map(renderItem)}
        </nav>

        {/* bottom small meta */}
        <div className="p-3 border-t border-slate-800/70 text-[10px] text-slate-500">
          الإصدار 1.0 • بث مركبات
        </div>
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 bg-black/45 z-40 md:hidden backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />

          {/* drawer panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-64 py-4 space-y-1 border-l shadow-2xl bg-slate-950/95 border-slate-800 md:hidden rounded-l-2xl">
            {/* header inside drawer */}
            <div className="flex items-center justify-between gap-3 px-4 pb-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  القائمة الرئيسية
                </p>
                <p className="text-[11px] text-slate-400">
                  انتقل بين وحدات البث والتحكّم.
                </p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700"
                aria-label="إغلاق"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  fill="none"
                >
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* nav */}
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
              {items.map(renderItem)}
            </nav>

            {/* footer mobile */}
            <div className="px-4 pt-3 pb-1 text-[10px] text-slate-500 border-t border-slate-800/60">
              متصل عبر واجهة الويب
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Sidebar;
