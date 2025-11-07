// client/src/App.tsx
// Root layout:
// - Uses AuthContext + MediaContext.
// - Admin/Manager: full pages.
// - Viewer: locked to BroadcastSources page.

import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./pages";
import Dashboard from "./pages/Dashboard";
import Control from "./pages/Control";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import BroadcastSources from "./pages/BroadcastSources";
import Vehicles from "./pages/Vehicles";
import { useAuth } from "./auth/AuthContext";
import { canSeeAdminPages } from "./auth/roles";

type PageId =
  | "home"
  | "dashboard"
  | "control"
  | "settings"
  | "broadcast"
  | "vehicles";

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<PageId>("home");

  const adminLike = useMemo(
    () => (user ? canSeeAdminPages(user.role) : false),
    [user],
  );

  useEffect(() => {
    if (!user) {
      if (page !== "home") setPage("home");
      return;
    }

    if (!adminLike && page !== "broadcast") {
      setPage("broadcast");
      return;
    }

    const allowed: PageId[] = [
      "home",
      "dashboard",
      "control",
      "settings",
      "broadcast",
      "vehicles",
    ];
    if (!allowed.includes(page)) {
      setPage("home");
    }
  }, [user, adminLike, page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        جاري التحميل...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const getHeader = (): { title: string; subtitle?: string } => {
    if (!adminLike) {
      return {
        title: "مصادر البث",
        subtitle: "عرض ومتابعة البث المباشر وطلبات الانضمام",
      };
    }

    switch (page) {
      case "dashboard":
        return { title: "لوحة البث", subtitle: "تحكم كامل بمصادر البث" };
      case "control":
        return {
          title: "تحكّم بالمركبة",
          subtitle: "تحكم في المركبة والكاميرا",
        };
      case "settings":
        return {
          title: "الإعدادات",
          subtitle: "إعداد خادم الإشارة وجودة البث",
        };
      case "broadcast":
        return {
          title: "مصادر البث",
          subtitle: "إدارة وعرض الكاميرات والشاشات المتصلة",
        };
      case "vehicles":
        return {
          title: "الأجهزة / المركبات",
          subtitle: "مصادر المركبات المتصلة والتحكم بها",
        };
      case "home":
      default:
        return { title: "الرئيسية", subtitle: "نظرة عامة على النظام" };
    }
  };

  const header = getHeader();

  const renderPage = () => {
    if (!adminLike) return <BroadcastSources />;

    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "control":
        return <Control />;
      case "settings":
        return <Settings />;
      case "broadcast":
        return <BroadcastSources />;
      case "vehicles":
        return <Vehicles />;
      case "home":
      default:
        return <Home />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar current={page} onChange={setPage} role={user.role as any} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={header.title} subtitle={header.subtitle} />
        <main className="flex-1 min-h-0 p-4 md:p-6 bg-slate-950/40">
          {renderPage()}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;
