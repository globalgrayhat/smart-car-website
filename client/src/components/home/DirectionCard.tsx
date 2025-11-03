import React from "react";

interface DirectionCardProps {
  direction: string;
}

const DirectionCard: React.FC<DirectionCardProps> = ({ direction }) => {
  return (
    <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">الاتجاه الحالي</h2>
        <span className="text-[10px] text-slate-500">تحكم المركبة</span>
      </div>
      <div className="font-medium text-center">{direction || "متوقف"}</div>
    </div>
  );
};

export default DirectionCard;
