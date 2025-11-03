import React from "react";

interface VehicleConnectionBarProps {
  connStatus: "connecting" | "connected" | "disconnected";
  lastDisconnect: number | null;
}

const VehicleConnectionBar: React.FC<VehicleConnectionBarProps> = ({
  connStatus,
  lastDisconnect,
}) => {
  const label =
    connStatus === "connected"
      ? "متصل بخادم الإشارة"
      : connStatus === "connecting"
      ? "جارٍ الاتصال بخادم الإشارة..."
      : "غير متصل بالخادم";

  const color =
    connStatus === "connected"
      ? "bg-emerald-500"
      : connStatus === "connecting"
      ? "bg-yellow-400"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2 p-3 border rounded-md bg-slate-900/50 border-slate-800">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm text-white">{label}</span>
      {lastDisconnect && (
        <span className="ml-auto text-[10px] text-slate-500">
          آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default VehicleConnectionBar;
