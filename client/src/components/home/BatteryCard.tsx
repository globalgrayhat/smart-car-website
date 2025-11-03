import React from "react";

interface BatteryCardProps {
  batteryLevel: number;
}

const BatteryCard: React.FC<BatteryCardProps> = ({ batteryLevel }) => {
  const barClass =
    batteryLevel > 60 ? "bg-green-500" : batteryLevel > 30 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">حالة الشحن</h2>
        <span className="text-sm text-slate-400">{batteryLevel}%</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${barClass}`} style={{ width: `${batteryLevel}%` }} />
      </div>
      <p className="text-[10px] text-slate-500 mt-1">
        قراءة تقديرية – يمكن ربطها بوحدة التحكم لاحقًا.
      </p>
    </div>
  );
};

export default BatteryCard;
