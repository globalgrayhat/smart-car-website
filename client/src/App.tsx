// src/App.tsx
import React, { useEffect, useState } from "react";
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

const App: React.FC = () => {
  const { user, loading } = useAuth();

  const [page, setPage] = useState<
    "home" | "dashboard" | "control" | "settings" | "broadcast" | "vehicles"
  >("home");

  // نحدد هنا حتى نستخدمه تحت بدون ما نغيّر ترتيب الهوكات
  const adminLike = user ? canSeeAdminPages(user.role) : false;

  // لو صار يوزر مش مشرف → ودّه على broadcast
  useEffect(() => {
    if (!adminLike && page !== "broadcast") {
      setPage("broadcast");
    }
  }, [adminLike, page]);

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

  // العنوان
  const current = (() => {
    if (!adminLike) {
      return {
        title: "مصادر البث",
        subtitle: "عرض الكاميرات المفتوحة من نفس الحساب أو الأجهزة المتصلة",
      };
    }
    switch (page) {
      case "dashboard":
        return { title: "لوحة البث", subtitle: "تحكم كامل بالشاشة" };
      case "control":
        return { title: "تحكّم بالمركبة", subtitle: "كاميرا + حركة" };
      case "settings":
        return { title: "الإعدادات", subtitle: "خادم الإشارة / الجودة" };
      case "broadcast":
        return { title: "مصادر البث", subtitle: "كاميرات الأجهزة المرتبطة" };
      case "vehicles":
        return { title: "الأجهزة المتصلة", subtitle: "عرض المصادر الحالية" };
      case "home":
      default:
        return { title: "الرئيسية", subtitle: "عرض عام" };
    }
  })();

  const renderPage = () => {
    if (!adminLike) {
      return <BroadcastSources />;
    }
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
        <Header title={current.title} subtitle={current.subtitle} />
        <main className="flex-1 min-h-0 p-4 md:p-6 bg-slate-950/40">
          {renderPage()}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default App;
