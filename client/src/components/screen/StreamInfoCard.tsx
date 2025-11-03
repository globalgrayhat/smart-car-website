import React from "react";

interface StreamInfoCardProps {
  isSharing: boolean;
  isBroadcasting: boolean;
  screenId: string | null;
}

const StreamInfoCard: React.FC<StreamInfoCardProps> = ({
  isSharing,
  isBroadcasting,
  screenId,
}) => {
  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <h3 className="mb-3 text-sm font-semibold text-white">معلومات البث</h3>
      <ul className="space-y-1 text-xs text-slate-300">
        <li>
          الحالة:{" "}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
              isSharing
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-slate-700/40 text-slate-200"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
            {isSharing ? "جاري المشاركة" : "متوقف"}
          </span>
        </li>
        <li>
          البث المباشر:{" "}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
              isBroadcasting
                ? "bg-red-500/10 text-red-300"
                : "bg-slate-700/40 text-slate-200"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
            {isBroadcasting ? "على الهواء" : "غير مباشر"}
          </span>
        </li>
        <li>المصدر: هذا الجهاز</li>
        <li>الوضع: شاشة فقط</li>
        <li>الجودة: 720p</li>
        {screenId && (
          <li className="text-[10px] text-slate-500 mt-1">
            معرف البث: {screenId}
          </li>
        )}
      </ul>
    </div>
  );
};

export default StreamInfoCard;
