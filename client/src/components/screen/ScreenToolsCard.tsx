import React from "react";

interface ScreenToolsCardProps {
  isSharing: boolean;
  connStatus: "connecting" | "connected" | "disconnected";
  onShare: () => void;
  onStopShare: () => void;
}

const ScreenToolsCard: React.FC<ScreenToolsCardProps> = ({
  isSharing,
  connStatus,
  onShare,
  onStopShare,
}) => {
  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <h3 className="mb-3 text-sm font-semibold text-white">أدوات المشاركة</h3>
      <p className="mb-3 text-xs text-slate-400">
        المشاركة غير البث. تقدر تشارك الشاشة وتبثها لاحقًا.
      </p>
      {!isSharing ? (
        <button
          onClick={onShare}
          disabled={connStatus !== "connected"}
          className="w-full py-2 text-sm text-white rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700/40 disabled:text-slate-500"
        >
          بدء مشاركة الشاشة
        </button>
      ) : (
        <button
          onClick={onStopShare}
          className="w-full py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600"
        >
          إيقاف مشاركة الشاشة
        </button>
      )}
    </div>
  );
};

export default ScreenToolsCard;
