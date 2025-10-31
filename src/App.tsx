import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Footer from "./components/Footer";

// pages
import Home from "./pages/index";
import Dashboard from "./pages/Dashboard";
import Control from "./pages/Control";
import Settings from "./pages/Settings";

const App: React.FC = () => {
  // ==========================
  // current page
  // ==========================
  const [page, setPage] = useState<"home" | "dashboard" | "control" | "settings">("home");

  // ==========================
  // global signaling status
  // ==========================
  const [connStatus, setConnStatus] = useState<"connected" | "disconnected" | "idle">("idle");
  const [prevConnStatus, setPrevConnStatus] = useState<"connected" | "disconnected" | "idle">("idle");
  const [toastVisible, setToastVisible] = useState(false);

  // ==========================
  // Arabic titles for header
  // ==========================
  const titles = {
    home: {
      title: "الرئيسية على النظام",
      subtitle: "حالة البث، المركبات المتصلة، وإجراءات سريعة.",
    },
    dashboard: {
      title: "لوحة البث",
      subtitle: "منطقة مشاركة الشاشة وإدارة البث المباشر.",
    },
    control: {
      title: "غرفة التحكّم",
      subtitle: "تشغيل الكاميرا، تسجيل، وأوامر المركبة.",
    },
    settings: {
      title: "الإعدادات",
      subtitle: "ضبط خادم الإشارة وجودة البث والتفضيلات.",
    },
  } as const;
  const current = titles[page];

  // ==========================
  // Listen to global connection events
  // ==========================
  useEffect(() => {
    const onDisconnected = () => {
      setConnStatus((prev) => {
        if (prev !== "disconnected") {
          setToastVisible(true);
          setPrevConnStatus("disconnected");
        }
        return "disconnected";
      });
    };

    const onConnected = () => {
      setConnStatus((prev) => {
        if (prev !== "connected") {
          setToastVisible(true);
          setPrevConnStatus("connected");
        }
        return "connected";
      });
    };

    window.addEventListener("signal:disconnected", onDisconnected);
    window.addEventListener("signal:connected", onConnected);

    return () => {
      window.removeEventListener("signal:disconnected", onDisconnected);
      window.removeEventListener("signal:connected", onConnected);
    };
  }, []);

  // ==========================
  // Auto hide toast after 5 seconds
  // ==========================
  useEffect(() => {
    if (!toastVisible) return;
    const id = setTimeout(() => setToastVisible(false), 5000);
    return () => clearTimeout(id);
  }, [toastVisible]);

  // ==========================
  // Render current page
  // ==========================
  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "control":
        return <Control />;
      case "settings":
        return <Settings />;
      case "home":
      default:
        return <Home />;
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <Sidebar current={page} onChange={setPage} />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <Header title={current.title} subtitle={current.subtitle} />

        {/* Toast notification */}
        <div
          className={`fixed top-16 right-4 z-[999] max-w-sm w-[90vw] md:w-80
            transform transition-all duration-300
            ${toastVisible ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}
          `}
        >
          {connStatus === "disconnected" && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs text-white border rounded-lg shadow-lg bg-red-600/95 border-red-400/30 md:text-sm animate-fadeIn">
              <span className="w-2 h-2 mt-1 bg-white rounded-full animate-pulse" />
              <div className="flex-1">
                <p className="font-medium text-sm mb-0.5">تم قطع الاتصال بخادم الإشارة</p>
                <p className="text-[11px] text-white/80">
                  يُرجى تشغيل الخادم أو التحقق من الشبكة.
                </p>
              </div>
              <button
                onClick={() => setToastVisible(false)}
                className="text-[10px] text-white/70 hover:text-white"
              >
                إغلاق
              </button>
            </div>
          )}
          {connStatus === "connected" && (
            <div className="flex items-start gap-2 px-3 py-2 text-xs text-white border rounded-lg shadow-lg bg-emerald-600/95 border-emerald-400/30 md:text-sm animate-fadeIn">
              <span className="w-2 h-2 mt-1 rounded-full bg-white/90 animate-pulse" />
              <div className="flex-1">
                <p className="font-medium text-sm mb-0.5">تم الاتصال بخادم الإشارة</p>
                <p className="text-[11px] text-white/80">الاتصال نشط حالياً، يمكنك بدء البث.</p>
              </div>
              <button
                onClick={() => setToastVisible(false)}
                className="text-[10px] text-white/70 hover:text-white"
              >
                إغلاق
              </button>
            </div>
          )}
        </div>

        {/* Main content */}
        <main className="flex-1 min-h-0 p-4 space-y-6 md:p-6">
          {renderPage()}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default App;
