// src/pages/Settings.tsx
// Raw signal tester + UI preferences
// - Connects to /mediasoup namespace
// - Adds auth token from localStorage if exists
// - Shows current values using small debug card
import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";
import SignalServerCard from "../components/settings/SignalServerCard";
import BroadcastQualityCard from "../components/settings/BroadcastQualityCard";
import UiDirectionCard from "../components/settings/UiDirectionCard";
import SettingsDebugBox from "../components/settings/SettingsDebugBox";

const Settings: React.FC = () => {
  // prefer WS base URL that points to Nest (e.g., http://localhost:3000)
  const defaultWsBase =
    import.meta.env.VITE_WS_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:3000";

  // user-editable base (we append /mediasoup automatically)
  const [serverUrl, setServerUrl] = useState(defaultWsBase);
  const [, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  const prevStatusRef = useRef<typeof connStatus>("disconnected");

  // UI prefs
  const [quality, setQuality] = useState("720p");
  const [uiDir, setUiDir] = useState<"rtl" | "ltr">("rtl");

  // connect to signal on url change
  useEffect(() => {
    if (!serverUrl) return;

    // final namespace
    const ns = `${serverUrl.replace(/\/+$/, "")}/mediasoup`;

    // try to read token from localStorage (AuthContext stores it)
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      "";

    const s = io(ns, {
      transports: ["websocket"],
      autoConnect: true,
      auth: token ? { token } : undefined, // mediasoup gateway validates JWT if present
    });

    setSocket(s);
    setConnStatus("connecting");

    const handleConnect = () => {
      setConnStatus((prev) => {
        if (prev !== "connected") notifySignalConnected();
        prevStatusRef.current = "connected";
        return "connected";
      });
    };
    const handleDisconnect = () => {
      setConnStatus((prev) => {
        if (prev !== "disconnected") notifySignalDisconnected();
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
    <div className="space-y-4 animate-fadeIn">
      <h2 className="text-xl font-semibold text-white">الإعدادات العامة</h2>
      <p className="text-sm text-slate-400">
        اختبر خادم الإشارة، وحدد جودة البث الافتراضية، واضبط اتجاه الواجهة.
      </p>

      {/* signal server (WS) */}
      <SignalServerCard
        serverUrl={serverUrl}
        onChange={setServerUrl}
        placeholder={defaultWsBase}
      />

      {/* broadcast quality selector */}
      <BroadcastQualityCard quality={quality} onChange={setQuality} />

      {/* UI direction */}
      <UiDirectionCard uiDir={uiDir} onChange={setUiDir} />

      {/* debug box */}
      <SettingsDebugBox
        serverUrl={serverUrl.replace(/\/+$/, "") + "/mediasoup"}
        quality={quality}
        uiDir={uiDir}
        connStatus={connStatus}
      />
    </div>
  );
};

export default Settings;
