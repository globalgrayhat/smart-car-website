import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";

const Settings: React.FC = () => {
  const [serverUrl, setServerUrl] = useState(import.meta.env.VITE_SIGNAL_SERVER);
  const [quality, setQuality] = useState("720p");
  const [uiDir, setUiDir] = useState<"rtl" | "ltr">("rtl");

  // ============================
  // connection test state
  // ============================
  const [, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");

  // store previous status to prevent duplicate notifications
  const prevStatusRef = useRef<"connecting" | "connected" | "disconnected">("disconnected");

  // ============================
  // test connection effect
  // ============================
  useEffect(() => {
    if (!serverUrl) return;

    const s = io(serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
    });
    setSocket(s);
    setConnStatus("connecting");

    const handleConnect = () => {
      setConnStatus((prev) => {
        if (prev !== "connected") {
          notifySignalConnected();
        }
        prevStatusRef.current = "connected";
        return "connected";
      });
    };

    const handleDisconnect = () => {
      setConnStatus((prev) => {
        if (prev !== "disconnected") {
          notifySignalDisconnected();
        }
        prevStatusRef.current = "disconnected";
        return "disconnected";
      });
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleDisconnect);

    return () => {
      s.disconnect();
      setConnStatus("disconnected");
    };
  }, [serverUrl]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">الإعدادات العامة</h2>
      <p className="text-sm text-slate-400">
        من هنا يمكنك ضبط عنوان خادم الإشارة، وجودة البث الافتراضية، وبعض تفضيلات
        الواجهة.
      </p>

      {/* Signaling server URL */}
      <div className="p-4 space-y-3 border rounded-md bg-slate-900/40 border-slate-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-100">عنوان خادم الإشارة</span>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
            placeholder={import.meta.env.VITE_SIGNAL_SERVER}
            dir="ltr"
          />
          <span className="text-xs text-slate-500">
            يُستخدم في بث الشاشة وكاميرا المركبة والتواصل اللحظي.
          </span>
        </label>
      </div>

      {/* Broadcast quality */}
      <div className="p-4 space-y-3 border rounded-md bg-slate-900/40 border-slate-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-100">جودة البث الافتراضية</span>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
          >
            <option value="360p">360p (منخفضة)</option>
            <option value="540p">540p (متوسطة)</option>
            <option value="720p">720p (موصى بها)</option>
          </select>
          <span className="text-xs text-slate-500">
            يمكن للعميل طلب جودة مختلفة لاحقًا.
          </span>
        </label>
      </div>

      {/* UI direction */}
      <div className="p-4 space-y-3 border rounded-md bg-slate-900/40 border-slate-800">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-100">اتجاه الواجهة</span>
          <select
            value={uiDir}
            onChange={(e) => setUiDir(e.target.value as "rtl" | "ltr")}
            className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
          >
            <option value="rtl">يمين → يسار (عربي)</option>
            <option value="ltr">يسار → يمين (إنجليزي)</option>
          </select>
          <span className="text-xs text-slate-500">Test</span>
        </label>
      </div>

      {/* debug preview */}
      <div className="p-3 text-xs border rounded-md bg-slate-900/20 border-slate-800/40 text-slate-500">
        <p>🔧 القيم الحالية (للاختبار فقط):</p>
        <p>• السيرفر: {serverUrl}</p>
        <p>• الجودة: {quality}</p>
        <p>• الاتجاه: {uiDir}</p>
        <p>• حالة الاتصال: {connStatus}</p>
      </div>
    </div>
  );
};

export default Settings;
