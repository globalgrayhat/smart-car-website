import React from "react";

interface UiDirectionCardProps {
  uiDir: "rtl" | "ltr";
  onChange: (dir: "rtl" | "ltr") => void;
}

const UiDirectionCard: React.FC<UiDirectionCardProps> = ({
  uiDir,
  onChange,
}) => {
  return (
    <div className="p-4 space-y-3 border rounded-md bg-slate-900/40 border-slate-800">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-100">اتجاه الواجهة</span>
        <select
          value={uiDir}
          onChange={(e) => onChange(e.target.value as "rtl" | "ltr")}
          className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
        >
          <option value="rtl">يمين → يسار (عربي)</option>
          <option value="ltr">يسار → يمين (إنجليزي)</option>
        </select>
        <span className="text-xs text-slate-500">
          تقدّر تخزّنه بالـ context حق الواجهة.
        </span>
      </label>
    </div>
  );
};

export default UiDirectionCard;
