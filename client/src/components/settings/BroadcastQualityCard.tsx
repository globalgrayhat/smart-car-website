import React from "react";

interface BroadcastQualityCardProps {
  quality: string;
  onChange: (q: string) => void;
}

const BroadcastQualityCard: React.FC<BroadcastQualityCardProps> = ({
  quality,
  onChange,
}) => {
  return (
    <div className="p-4 space-y-3 border rounded-md bg-slate-900/40 border-slate-800">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-100">جودة البث الافتراضية</span>
        <select
          value={quality}
          onChange={(e) => onChange(e.target.value)}
          className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
        >
          <option value="360p">360p (منخفضة)</option>
          <option value="540p">540p (متوسطة)</option>
          <option value="720p">720p (موصى بها)</option>
        </select>
        <span className="text-xs text-slate-500">
          تقدر تغيّرها ديناميك من صفحة البث.
        </span>
      </label>
    </div>
  );
};

export default BroadcastQualityCard;
