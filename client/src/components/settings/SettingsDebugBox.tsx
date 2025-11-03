import React from "react";
import type { ConnStatus } from "../../hooks/useSignalTest";

interface SettingsDebugBoxProps {
  serverUrl: string;
  quality: string;
  uiDir: "rtl" | "ltr";
  connStatus: ConnStatus;
}

const SettingsDebugBox: React.FC<SettingsDebugBoxProps> = ({
  serverUrl,
  quality,
  uiDir,
  connStatus,
}) => {
  return (
    <div className="p-3 text-xs border rounded-md bg-slate-900/20 border-slate-800/40 text-slate-500">
      <p>🔧 القيم الحالية:</p>
      <p>• السيرفر: {serverUrl || "—"}</p>
      <p>• الجودة: {quality}</p>
      <p>• الاتجاه: {uiDir}</p>
      <p>• حالة الاتصال: {connStatus}</p>
    </div>
  );
};

export default SettingsDebugBox;
