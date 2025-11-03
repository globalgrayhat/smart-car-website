import React from "react";

interface ServerStatusCardProps {
  status: "connecting" | "connected" | "disconnected";
  lastDisconnect: number | null;
}

const ServerStatusCard: React.FC<ServerStatusCardProps> = ({ status, lastDisconnect }) => {
  const text =
    status === "connected"
      ? "متصل"
      : status === "connecting"
      ? "جارٍ الاتصال..."
      : "غير متصل";

  const dotClass =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
      ? "bg-yellow-400"
      : "bg-red-500";

  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">حالة الخادم</h2>
        <span className="text-[10px] text-slate-500">Socket.io</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${dotClass}`} />
        <span>{text}</span>
      </div>
      {lastDisconnect && (
        <p className="text-[10px] text-slate-500 mt-1">
          آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default ServerStatusCard;
