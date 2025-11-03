import React from "react";
import { IconRec } from "../home/StreamIcons";

interface ScreenActionBarProps {
  isSharing: boolean;
  isBroadcasting: boolean;
  isRecording: boolean;
  connStatus: "connecting" | "connected" | "disconnected";
  onShare: () => void;
  onStopShare: () => void;
  onStartBroadcast: () => void;
  onStopBroadcast: () => void;
  onCapture: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const baseBtn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition active:scale-[.985] disabled:opacity-50 disabled:cursor-not-allowed";

const ScreenActionBar: React.FC<ScreenActionBarProps> = ({
  isSharing,
  isBroadcasting,
  isRecording,
  connStatus,
  onShare,
  onStopShare,
  onStartBroadcast,
  onStopBroadcast,
  onCapture,
  onStartRecording,
  onStopRecording,
}) => {
  const canShare = connStatus === "connected";
  const canCast = isSharing && connStatus === "connected";
  const canCapture = isSharing;
  const canRecord = isSharing;

  return (
    <div className="flex flex-wrap gap-2 mt-4 p-2.5 rounded-md bg-slate-900/30 border border-slate-800/60">
      {/* مشاركة الشاشة */}
      {!isSharing ? (
        <button
          onClick={onShare}
          disabled={!canShare}
          className={`${baseBtn} ${
            canShare
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          مشاركة الشاشة
        </button>
      ) : (
        <button
          onClick={onStopShare}
          className={`${baseBtn} bg-red-500 text-white hover:bg-red-600`}
        >
          إيقاف المشاركة
        </button>
      )}

      {/* البث المباشر */}
      {!isBroadcasting ? (
        <button
          onClick={onStartBroadcast}
          disabled={!canCast}
          className={`${baseBtn} ${
            canCast
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          <IconRec />
          بدء البث
        </button>
      ) : (
        <button
          onClick={onStopBroadcast}
          className={`${baseBtn} bg-orange-500/90 text-white hover:bg-orange-600`}
        >
          <IconRec active />
          إيقاف البث
        </button>
      )}

      {/* التقاط صورة */}
      <button
        onClick={onCapture}
        disabled={!canCapture}
        className={`${baseBtn} ${
          canCapture
            ? "bg-slate-700 text-white hover:bg-slate-600"
            : "bg-slate-800 text-slate-400"
        }`}
      >
        التقاط صورة
      </button>

      {/* تسجيل الشاشة */}
      {!isRecording ? (
        <button
          onClick={onStartRecording}
          disabled={!canRecord}
          className={`${baseBtn} ${
            canRecord
              ? "bg-slate-700 text-white hover:bg-slate-600"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          <IconRec />
          تسجيل الشاشة
        </button>
      ) : (
        <button
          onClick={onStopRecording}
          className={`${baseBtn} bg-red-500 text-white hover:bg-red-600`}
        >
          <IconRec active />
          إيقاف التسجيل
        </button>
      )}
    </div>
  );
};

export default ScreenActionBar;
