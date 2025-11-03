import React from "react";

interface CameraVideoSurfaceProps {
  loading: boolean;
  connected: boolean;
  zoom: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onRetry: () => void;
  onResetIcon: React.ReactNode;
}

const CameraVideoSurface: React.FC<CameraVideoSurfaceProps> = ({
  loading,
  connected,
  zoom,
  videoRef,
  onRetry,
  onResetIcon,
}) => {
  return (
    <div className="relative w-full aspect-video bg-gradient-to-br from-slate-900 to-slate-800">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-white/70">
          <div className="w-12 h-12 border-2 rounded-full border-white/30 border-t-white/90 animate-spin" />
          <p className="text-sm">نجهز الكاميرا لك...</p>
        </div>
      ) : !connected ? (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-white/70">
          <div className="p-4 border rounded-full bg-red-500/10 border-red-400/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-red-300"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 9v3.75m-9.303 3.376L10.53 3.53a1.875 1.875 0 013.338 0l7.834 12.596A1.875 1.875 0 0120.084 20.5H3.916a1.875 1.875 0 01-1.219-3.374z"
              />
            </svg>
          </div>
          <p>الكاميرا غير متصلة</p>
          <button
            type="button"
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm flex items-center gap-2"
            onClick={onRetry}
          >
            {onResetIcon}
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="object-cover w-full h-full transition-transform will-change-transform"
          style={{ transform: `scale(${zoom})` }}
        />
      )}
    </div>
  );
};

export default CameraVideoSurface;
