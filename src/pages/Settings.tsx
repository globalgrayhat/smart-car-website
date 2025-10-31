import React, { useState } from "react";

// Settings page for admin panel
// - store signaling server URL (used by screen / camera pages)
// - store default broadcast quality
// - store UI direction (RTL/LTR) if needed
// NOTE: you can later connect this to a context or backend

const Settings: React.FC = () => {
  const [serverUrl, setServerUrl] = useState("http://localhost:5000");
  const [quality, setQuality] = useState("720p");
  const [uiDir, setUiDir] = useState<"rtl" | "ltr">("rtl");

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">الإعدادات العامة</h2>
      <p className="text-sm text-slate-400">
        من هنا يمكنك ضبط عنوان خادم الإشارة، وجودة البث الافتراضية، وبعض تفضيلات
        الواجهة.
      </p>

      {/* Signaling server URL */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-100">عنوان خادم الإشارة</span>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
            placeholder="http://localhost:5000"
            dir="ltr"
          />
          <span className="text-xs text-slate-500">
            يُستخدم في بث الشاشة وكاميرا المركبة والتواصل اللحظي.
          </span>
        </label>
      </div>

      {/* broadcast quality */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-100">جودة البث الافتراضية</span>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
          >
            <option value="360p">360p (منخفضة)</option>
            <option value="540p">540p (متوسطة)</option>
            <option value="720p">720p (موصى بها)</option>
          </select>
          <span className="text-xs text-slate-500">
            يمكن للعميل (المشاهد) طلب جودة مختلفة في وقت لاحق. Test
          </span>
        </label>
      </div>

      {/* UI direction */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-md p-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-100">اتجاه الواجهة</span>
          <select
            value={uiDir}
            onChange={(e) => setUiDir(e.target.value as "rtl" | "ltr")}
            className="bg-slate-950/70 border border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
          >
            <option value="rtl">يمين → يسار (عربي)</option>
            <option value="ltr">يسار → يمين (إنجليزي)</option>
          </select>
          <span className="text-xs text-slate-500">Test</span>
        </label>
      </div>

      {/* debug preview */}
      <div className="bg-slate-900/20 border border-slate-800/40 rounded-md p-3 text-xs text-slate-500">
        {/* this box is just to show current values */}
        <p>🔧 القيم الحالية (للاختبار فقط):</p>
        <p>• السيرفر: {serverUrl}</p>
        <p>• الجودة: {quality}</p>
        <p>• الاتجاه: {uiDir}</p>
      </div>
    </div>
  );
};

export default Settings;
