import React from "react";

interface ScreenStatusCardProps {
  connStatus: "connecting" | "connected" | "disconnected";
  lastDisconnect: number | null;
}

const ScreenStatusCard: React.FC<ScreenStatusCardProps> = ({
  connStatus,
  lastDisconnect,
}) => {
  const label =
    connStatus === "connected"
      ? "متصل بالخادم"
      : connStatus === "connecting"
      ? "جارٍ الاتصال بالخادم..."
      : "غير متصل بالخادم";

  const color =
    connStatus === "connected"
      ? "bg-emerald-500"
      : connStatus === "connecting"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <h3 className="mb-3 text-sm font-semibold text-white">حالة الاتصال</h3>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-sm text-white">{label}</span>
      </div>
      {lastDisconnect && (
        <p className="text-[10px] text-slate-500 mt-2">
          آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
        </p>
      )}
      <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
        في حال عدم توفر خادم الإشارة لن تتمكن من مشاركة الشاشة أو البث.
      </p>
    </div>
  );
};

export default ScreenStatusCard;
