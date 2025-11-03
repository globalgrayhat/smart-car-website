import React from "react";

export const IconCamera: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
    <path d="M7 7h2l1-1h4l1 1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" strokeWidth="1.3" />
    <circle cx="12" cy="12" r="3" strokeWidth="1.3" />
  </svg>
);

export const IconScreen: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
    <rect x="3" y="4" width="18" height="12" rx="2" strokeWidth="1.4" />
    <path d="M10 20h4" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const IconRec: React.FC<{ active?: boolean }> = ({ active = false }) => (
  <span
    className={`inline-flex h-2.5 w-2.5 rounded-full ${
      active ? "bg-red-400 animate-pulse" : "bg-slate-500"
    }`}
  />
);

export const IconShare: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none">
    <path d="M4 12v7a1 1 0 0 0 1 1h5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* كان في مسار ناقص حرف L — تعدّل */}
    <path d="M10 17L20 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 7h6v6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
