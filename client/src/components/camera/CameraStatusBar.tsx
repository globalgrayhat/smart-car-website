import React from "react";

interface CameraStatusBarProps {
  connected: boolean;
  loading: boolean;
  error: string | null;
  isSharing: boolean;
}

const CameraStatusBar: React.FC<CameraStatusBarProps> = ({
  connected,
  loading,
  error,
  isSharing,
}) => {
  return (
    <div className="absolute z-20 flex items-center justify-between gap-3 top-3 left-3 right-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${
            connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-xs text-white/80">
          {loading
            ? "جار الاتصال بالكاميرا..."
            : connected
            ? "الكاميرا متصلة"
            : "الكاميرا غير متصلة"}
        </span>
        {isSharing && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/90 text-white">
            Sharing
          </span>
        )}
        {error && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/90 text-white">
            {error}
          </span>
        )}
      </div>
    </div>
  );
};

export default CameraStatusBar;
