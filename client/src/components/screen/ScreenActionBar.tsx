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
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {!isSharing ? (
        <button
          onClick={onShare}
          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs disabled:bg-slate-700/40 disabled:text-slate-500"
          disabled={connStatus !== "connected"}
        >
          مشاركة الشاشة
        </button>
      ) : (
        <button
          onClick={onStopShare}
          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs"
        >
          إيقاف المشاركة
        </button>
      )}

      {!isBroadcasting ? (
        <button
          onClick={onStartBroadcast}
          disabled={!isSharing || connStatus !== "connected"}
          className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
            !isSharing || connStatus !== "connected"
              ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-600 text-white"
          }`}
        >
          <IconRec />
          بدء البث
        </button>
      ) : (
        <button
          onClick={onStopBroadcast}
          className="px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 bg-orange-500/90 hover:bg-orange-600 text-white"
        >
          <IconRec active />
          إيقاف البث
        </button>
      )}

      <button
        onClick={onCapture}
        disabled={!isSharing}
        className={`px-3 py-1.5 text-xs rounded-md ${
          !isSharing
            ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
            : "bg-emerald-500 hover:bg-emerald-600 text-white"
        }`}
      >
        التقاط صورة
      </button>

      {!isRecording ? (
        <button
          onClick={onStartRecording}
          disabled={!isSharing}
          className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
            !isSharing
              ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
              : "bg-slate-700 hover:bg-slate-600 text-white"
          }`}
        >
          <IconRec />
          تسجيل الشاشة
        </button>
      ) : (
        <button
          onClick={onStopRecording}
          className="px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white"
        >
          <IconRec active />
          إيقاف التسجيل
        </button>
      )}
    </div>
  );
};

export default ScreenActionBar;
