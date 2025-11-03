import React from "react";
import { IconRec, IconScreen } from "../home/StreamIcons";

interface ScreenPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isSharing: boolean;
  isBroadcasting: boolean;
  isRecording: boolean;
  isMobile: boolean;
  connStatus: "connecting" | "connected" | "disconnected";
}

const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  videoRef,
  isSharing,
  isBroadcasting,
  isRecording,
  isMobile,
  connStatus,
}) => {
  const showStatusBar = isBroadcasting || isRecording;

  return (
    <div
      className={`relative rounded-md border border-slate-700/70 overflow-hidden bg-slate-950/40 ${
        isMobile ? "aspect-[9/16]" : "aspect-video"
      } flex items-center justify-center`}
    >
      {/* الفيديو */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="object-contain w-full h-full bg-black/40"
      />

      {/* شريط الحالة العلوي */}
      {showStatusBar && (
        <div className="absolute inset-x-0 flex justify-center gap-2 pointer-events-none top-3">
          {isBroadcasting && (
            <div className="flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full shadow-sm bg-red-500/90">
              <IconRec active />
              على الهواء
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full shadow-sm bg-red-500/90">
              <IconRec active />
              تسجيل
            </div>
          )}
        </div>
      )}

      {/* حالة عدم المشاركة */}
      {!isSharing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <div className="flex items-center justify-center border rounded-full shadow-sm w-14 h-14 bg-slate-900/60 text-slate-100 border-slate-700/40">
            <IconScreen />
          </div>
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg px-4 py-2.5 min-w-[220px] shadow-sm">
            <p className="mb-1 text-sm text-slate-100">
              لا توجد شاشة مشتركة حالياً
            </p>
            {connStatus !== "connected" ? (
              <p className="text-xs text-red-300">
                الخادم غير متصل – شغّل الخادم أولاً
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                اضغط "مشاركة الشاشة" لبدء المشاركة
              </p>
            )}
          </div>
        </div>
      )}

      {/* غرايدنت خفيف من تحت عشان يبين الـUI لو حطيت فوقه أكشن بار */}
      <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none bg-gradient-to-t from-slate-950/70 to-transparent" />
    </div>
  );
};

export default ScreenPreview;
