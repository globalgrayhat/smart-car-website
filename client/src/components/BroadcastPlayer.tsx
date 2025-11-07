// client/src/components/BroadcastPlayer.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from "react";

type BroadcastPlayerProps = {
  src?: string | null;
  playbackUrl?: string | null;
  streamId?: string | null;
  ownerId?: string | number | null;
  kind?: "camera" | "screen" | "custom";
};

const MAX_RETRY = 6; // ~ 1m backoff كحد أقصى

const BroadcastPlayer: React.FC<BroadcastPlayerProps> = ({
  src,
  playbackUrl,
  streamId,
  ownerId,
  kind = "camera",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any | null>(null);
  const stallTimer = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const retryRef = useRef(0);

  const PLAYBACK_BASE = (import.meta.env.VITE_PLAYBACK_BASE || "")
    .toString()
    .trim()
    .replace(/\/+$/, "");

  const finalUrl: string | null =
    (src && src.trim()) ||
    (playbackUrl && playbackUrl.trim()) ||
    (PLAYBACK_BASE && streamId
      ? `${PLAYBACK_BASE}/${String(streamId).trim()}.m3u8`
      : null);

  const [errMsg, setErrMsg] = useState<string | null>(null);

  const cleanup = () => {
    const h = hlsRef.current;
    if (h) {
      try { h.destroy(); } catch {}
    }
    hlsRef.current = null;
    if (stallTimer.current) {
      window.clearInterval(stallTimer.current);
      stallTimer.current = null;
    }
  };

  const emitDown = (reason: string) => {
    window.dispatchEvent(new CustomEvent("broadcast:down", { detail: { url: finalUrl, reason } }));
  };
  const emitUp = () => {
    window.dispatchEvent(new CustomEvent("broadcast:up", { detail: { url: finalUrl } }));
  };

  const scheduleRetry = () => {
    const tries = retryRef.current;
    if (tries >= MAX_RETRY) return; // خلاص
    const delay = Math.min(60000, 1000 * Math.pow(2, tries)); // 1s,2s,4s,... max 60s
    retryRef.current += 1;
    setTimeout(() => {
      void setup();
    }, delay);
  };

  const startStallWatch = (video: HTMLVideoElement) => {
    if (stallTimer.current) window.clearInterval(stallTimer.current);
    lastTimeRef.current = video.currentTime;
    stallTimer.current = window.setInterval(() => {
      const t = video.currentTime;
      // لا صوت لا صورة: مايتحرك && readyState ضعيف → اعتبره stall
      if (video.readyState < 2 || Math.abs(t - lastTimeRef.current) < 0.01) {
        setErrMsg("انقطاع مؤقت — نحاول إعادة التوصيل…");
        emitDown("stall");
        // نفك ونعيد تهيئة
        cleanup();
        scheduleRetry();
      } else {
        setErrMsg(null);
        emitUp();
      }
      lastTimeRef.current = t;
    }, 5000);
  };

  const setup = async () => {
    const video = videoRef.current;
    if (!video || !finalUrl) return;
    cleanup();
    setErrMsg(null);

    try {
      // Native HLS
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = finalUrl;
        await video.play().catch(() => {});
        startStallWatch(video);
        emitUp();
        return;
      }

      const HlsCtor = (window as any).Hls;
      if (HlsCtor && HlsCtor.isSupported?.()) {
        const h = new HlsCtor({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = h;

        h.on(HlsCtor.Events.ERROR, (_evt: any, data: any) => {
          const fatal = data?.fatal;
          const type = data?.type || "unknown";
          const details = data?.details || "";
          if (fatal) {
            setErrMsg("انقطاع البث — إعادة محاولة…");
            emitDown(`${type}:${details}`);
            h.destroy();
            scheduleRetry();
          }
        });

        h.on(HlsCtor.Events.FRAG_LOADED, () => {
          retryRef.current = 0; // نجاح → صفّر العداد
          setErrMsg(null);
          emitUp();
        });

        h.loadSource(finalUrl);
        h.attachMedia(video);
        h.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          startStallWatch(video);
          emitUp();
        });
        return;
      }

      // fallback mp4 أو متصفح قديم
      video.src = finalUrl;
      await video.play().catch(() => {});
      startStallWatch(video);
      emitUp();
    } catch (e: any) {
      setErrMsg("تعذّر تشغيل البث — نحاول إعادة الاتصال…");
      emitDown(e?.message || "setup-error");
      scheduleRetry();
    }
  };

  useEffect(() => {
    retryRef.current = 0;
    void setup();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalUrl]);

  // أعد المحاولة عند رجوع التبويب للواجهة
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && videoRef.current && finalUrl) {
        void setup();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [finalUrl]);

  if (!finalUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-1 px-3 py-4 text-xs text-center rounded-md bg-slate-950/70 text-slate-300">
        <p>لا يوجد رابط تشغيل متاح للبث حالياً.</p>
        <p className="text-[10px] text-slate-500">
          تأكد من قيمة VITE_PLAYBACK_BASE و streamId.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {errMsg && (
        <div className="absolute z-20 px-2 py-1 text-[10px] rounded bg-amber-500/90 text-slate-950 top-2 left-2">
          {errMsg}
        </div>
      )}
      <video
        ref={videoRef}
        className="object-contain w-full h-full bg-black rounded-md"
        controls
        playsInline
        autoPlay
        muted={kind !== "camera"}
        onError={() => {
          setErrMsg("خطأ في المشغّل — إعادة محاولة…");
          emitDown("video-error");
          cleanup();
          scheduleRetry();
        }}
      />
    </div>
  );
};

export default BroadcastPlayer;
