import React from "react";

interface SignalServerCardProps {
  serverUrl: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const SignalServerCard: React.FC<SignalServerCardProps> = ({
  serverUrl,
  onChange,
  placeholder,
}) => {
  return (
    <div className="p-4 space-y-3 border rounded-md bg-slate-900/40 border-slate-800">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-100">عنوان خادم الإشارة</span>
        <input
          value={serverUrl}
          onChange={(e) => onChange(e.target.value)}
          className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
          placeholder={placeholder}
          dir="ltr"
        />
        <span className="text-xs text-slate-500">
          يُستخدم في بث الشاشة وكاميرا المركبة والتواصل اللحظي.
        </span>
      </label>
    </div>
  );
};

export default SignalServerCard;
