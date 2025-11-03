// frontend/src/components/home/ScreenPanel.tsx
import React, { useEffect, useRef, useState } from "react";
import { useMedia } from "../../media/MediaContext";

type Conn = "connecting" | "connected" | "disconnected";

interface ScreenPanelProps {
  connStatus: Conn;
  isMobile: boolean;
}

const ScreenPanel: React.FC<ScreenPanelProps> = ({ connStatus, isMobile }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const media = useMedia() as any;
  const screen = media?.screen;

  // نخلي الجودة حالة لوكل لكن لو حبيت ترفعها للكونتكست سهل
  const [quality, setQuality] = useState<"360p" | "540p" | "720p">("720p");

  // نربط الفيديو أول ما الجاهز يطلع
  useEffect(() => {
    if (videoRef.current && screen?.bindVideo) {
      screen.bindVideo(videoRef.current);
    }
  }, [screen]);

  // سد ثغرة التأخير
  useEffect(() => {
    const id = setTimeout(() => {
      if (videoRef.current && screen?.bindVideo) {
        screen.bindVideo(videoRef.current);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [screen]);

  const isReady = Boolean(screen);
  const isSharing = Boolean(screen?.isSharing);
  const isBroadcasting = Boolean(screen?.isBroadcasting);
  const isRecording = Boolean(screen?.isRecording);
  const recordUrl = screen?.recordUrl ?? null;

  const handleStart = () => {
    if (!screen) return;
    screen.start?.({ quality, mobile: isMobile });
  };

  const handleStop = () => {
    screen?.stop?.();
  };

  return (
    <div className="flex flex-col gap-3 p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      {/* رأس الكرت */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">شاشة المضيف</h3>
          <p className="text-xs text-slate-400">
            {connStatus === "connected"
              ? "الخادم متصل — تقدر تبدأ المشاركة."
              : "الخادم غير متصل — ما راح يشتغل البث."}
          </p>
        </div>

        {!isSharing ? (
          <button
            onClick={handleStart}
            disabled={!isReady || connStatus !== "connected"}
            className="px-3 py-1.5 text-xs rounded bg-emerald-500 text-slate-950 disabled:bg-slate-700/40 disabled:text-slate-500"
          >
            بدء مشاركة الشاشة
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-3 py-1.5 text-xs rounded bg-red-500 text-white"
          >
            إيقاف المشاركة
          </button>
        )}
      </div>

      {/* المعاينة */}
      <div
        className={`relative rounded-md border border-slate-700 overflow-hidden bg-slate-950/40 ${
          isMobile ? "aspect-[9/16]" : "aspect-video"
        } flex items-center justify-center`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="object-contain w-full h-full bg-black/40"
        />

        {/* حالة التحميل أو مافيه شاشة */}
        {!isReady && (
          <p className="absolute text-xs text-slate-500">
            يتم تهيئة وحدة مشاركة الشاشة…
          </p>
        )}
        {isReady && !isSharing && (
          <p className="absolute text-xs text-slate-500">
            لا توجد شاشة مشتركة حالياً.
          </p>
        )}

        {/* بادجات */}
        {isBroadcasting && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] rounded bg-red-500/90 text-white">
            بث مباشر
          </span>
        )}
        {isRecording && (
          <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] rounded bg-orange-500/90 text-white">
            تسجيل
          </span>
        )}
      </div>

      {/* الأكشنات تحت */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-300">
          الدقّة:
          <select
            value={quality}
            onChange={(e) =>
              setQuality(e.target.value as "360p" | "540p" | "720p")
            }
            disabled={!isReady || isSharing}
            className="px-2 py-1 text-xs border rounded outline-none bg-slate-950/70 border-slate-700"
          >
            <option value="360p">360</option>
            <option value="540p">540</option>
            <option value="720p">720</option>
          </select>
        </label>

        {isReady && (
          <>
            {!isBroadcasting ? (
              <button
                onClick={screen.startBroadcast}
                disabled={!isSharing}
                className={`px-3 py-1.5 text-xs rounded ${
                  !isSharing
                    ? "bg-slate-700/40 text-slate-500"
                    : "bg-orange-500 text-white"
                }`}
              >
                بدء البث
              </button>
            ) : (
              <button
                onClick={screen.stopBroadcast}
                className="px-3 py-1.5 text-xs rounded bg-orange-500/90 text-white"
              >
                إيقاف البث
              </button>
            )}

            <button
              onClick={screen.capture}
              disabled={!isSharing}
              className={`px-3 py-1.5 text-xs rounded ${
                !isSharing
                  ? "bg-slate-700/40 text-slate-500"
                  : "bg-emerald-500 text-white"
              }`}
            >
              التقاط
            </button>

            {!isRecording ? (
              <button
                onClick={screen.startRecording}
                disabled={!isSharing}
                className={`px-3 py-1.5 text-xs rounded ${
                  !isSharing
                    ? "bg-slate-700/40 text-slate-500"
                    : "bg-slate-700 text-white"
                }`}
              >
                تسجيل
              </button>
            ) : (
              <button
                onClick={screen.stopRecording}
                className="px-3 py-1.5 text-xs rounded bg-red-500 text-white"
              >
                إيقاف التسجيل
              </button>
            )}

            {recordUrl && (
              <a
                href={recordUrl}
                download="screen-recording.webm"
                className="ml-auto text-xs underline text-emerald-400"
              >
                تنزيل التسجيل
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScreenPanel;
