// src/components/Sidebar.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";

interface SidebarProps {
  current: string;
  onChange: (p: any) => void;
  role?: "ADMIN" | "BROADCAST_MANAGER" | "VIEWER" | string;
}

// ... نفس NavIcon اللي عندك ...

const baseItems = [
  { id: "home", label: "الرئيسية", icon: "home" as const },
  { id: "dashboard", label: "لوحة البث", icon: "dash" as const },
  {
    id: "control",
    label: "التحكّم",
    icon: "control" as const,
    needs: ["ADMIN", "BROADCAST_MANAGER"],
  },
  {
    id: "broadcast",
    label: "مصادر البث",
    icon: "broadcast" as const,
    needs: ["ADMIN", "BROADCAST_MANAGER"],
  },
  {
    id: "vehicles",
    label: "المركبات",
    icon: "vehicles" as const,
    needs: ["ADMIN", "BROADCAST_MANAGER"],
  },
  { id: "settings", label: "الإعدادات", icon: "settings" as const },
];

const Sidebar: React.FC<SidebarProps> = ({ current, onChange, role }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setMobileOpen((prev) => !prev);
    };
    window.addEventListener("sidebar:toggle", handler);
    return () => window.removeEventListener("sidebar:toggle", handler);
  }, []);

  // لو مشاهد -> بس صفحة المشاهدة (dashboard)
  const visibleItems =
    role === "VIEWER"
      ? baseItems.filter((i) => i.id === "dashboard")
      : baseItems.filter((item) => {
          if (!item.needs) return true;
          return item.needs.includes(role as string);
        });

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
        {isActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-l-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
        )}
        <span className="flex-1 text-right">{item.label}</span>
        <span
          className={`flex items-center justify-center rounded-md p-1.5 ${
            isActive
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-slate-900/20 text-slate-300/70 group-hover:text-white"
          }`}
        >
          {/* استعمل نفس NavIcon اللي عندك */}
          {/* <NavIcon type={item.icon} /> */}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* desktop */}
      <aside className="flex-col hidden border-r md:flex md:w-56 lg:w-64 border-slate-800 bg-slate-950/40 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 border-b h-14 border-slate-800/70">
          <span className="text-sm font-semibold tracking-tight text-white">
            لوحة تحكم البث
          </span>
          <span className="text-[14px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/10">
            تجريبي
          </span>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map(renderItem)}
        </nav>

        <div className="p-3 border-t border-slate-800/70 text-[10px] text-slate-500">
          الإصدار 1.0 • بث مركبات
        </div>
      </aside>

      {/* mobile like ما هو عندك بالضبط، نفس الفلتر */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/45 z-40 md:hidden backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-64 py-4 space-y-1 border-l shadow-2xl bg-slate-950/95 border-slate-800 md:hidden rounded-l-2xl">
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
                ✕
              </button>
            </div>
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
              {visibleItems.map(renderItem)}
            </nav>
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
