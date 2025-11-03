import React from "react";

interface VehicleStatusCardProps {
  vehicleCameraOwner: string | null;
}

const VehicleStatusCard: React.FC<VehicleStatusCardProps> = ({ vehicleCameraOwner }) => {
  const vehicleCameraText = vehicleCameraOwner
    ? "المركبة المتصلة: تبث الكاميرا الآن"
    : "لا توجد مركبة متصلة";
  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">المركبة المتّصلة</h2>
        <span className="text-[10px] text-slate-500">Camera source</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-3 h-3 rounded-full ${
            vehicleCameraOwner ? "bg-emerald-500" : "bg-slate-600"
          }`}
        />
        <span className="text-sm">{vehicleCameraText}</span>
      </div>
      {vehicleCameraOwner ? (
        <p className="text-[10px] text-emerald-400">
          المصدر من المركبة – سيتم تعطيل كاميرا الإدارة.
        </p>
      ) : (
        <p className="text-[10px] text-slate-500">
          لا يوجد مصدر من مركبة، يمكن تشغيل كاميرا الإدارة.
        </p>
      )}
    </div>
  );
};

export default VehicleStatusCard;
