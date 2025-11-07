/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { IconCamera, IconRec } from "../home/StreamIcons";

interface VehicleCameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraOn: boolean;
  isRecording: boolean;
  zoom: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  isRemote?: boolean;
  remoteLabel?: string | null;
}

const VehicleCameraPreview: React.FC<VehicleCameraPreviewProps> = ({
  videoRef,
  isCameraOn,
  isRecording,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  isRemote = false,
  remoteLabel,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative rounded-lg overflow-hidden bg-slate-950/40 flex items-center justify-center h-[320px] md:h-[360px] border border-slate-800/60">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="object-cover w-full h-full transition-transform bg-black will-change-transform"
          style={{ transform: `scale(${zoom})` }}
        />

        {!isCameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/45 backdrop-blur-sm">
            <div className="flex items-center justify-center border rounded-full shadow-lg h-14 w-14 bg-slate-900/70 border-slate-700/50">
              <IconCamera />
            </div>
            <p className="text-sm text-slate-200">
              لا يوجد بث كاميرا حالياً
            </p>
            <p className="text-xs text-slate-500">
              انتظر المضيف أو شغّل الكاميرا من جهاز التحكم.
            </p>
          </div>
        )}

        {isRemote && isCameraOn && (
          <div className="absolute inset-x-3 top-3 px-3 py-1 rounded bg-emerald-500/15 border border-emerald-400/30 text-[11px] text-emerald-50">
            البث من جهاز / مركبة ثانية
            {remoteLabel ? ` — ${remoteLabel}` : ""}
          </div>
        )}

        {isRecording && (
          <div className="absolute flex items-center gap-2 px-3 py-1 text-xs text-white rounded-full top-3 left-3 bg-red-500/85">
            <IconRec active />
            تسجيل جارٍ
          </div>
        )}
      </div>

      {(onZoomIn || onZoomOut || onZoomReset) && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-slate-400">التقريب:</span>
          <button
            onClick={onZoomOut}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-white"
          >
            تصغير
          </button>
          <button
            onClick={onZoomIn}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-white"
          >
            تكبير
          </button>
          <button
            onClick={onZoomReset}
            className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-white"
          >
            إعادة الضبط
          </button>
          <span className="text-xs text-slate-500">
            {(zoom * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default VehicleCameraPreview;
