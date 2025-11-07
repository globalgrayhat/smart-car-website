/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BroadcastPlayer
 *
 * Generic HLS/MP4 player:
 * - Uses src, playbackUrl, or derives URL from VITE_PLAYBACK_BASE + streamId.
 * - Supports native HLS, hls.js (if available), and direct file playback.
 * - Responsive container friendly for various layouts.
 */

import React, { useEffect, useRef } from "react";

type BroadcastPlayerProps = {
  src?: string | null;
  playbackUrl?: string | null;
  streamId?: string | null;
  ownerId?: string | number | null;
  kind?: "camera" | "screen" | "custom";
};

const BroadcastPlayer: React.FC<BroadcastPlayerProps> = ({
  src,
  playbackUrl,
  streamId,
  ownerId, // reserved for future usage
  kind = "camera",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !finalUrl) return;

    let hls: any | null = null;

    const setup = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = finalUrl;
          await video.play().catch(() => {});
          return;
        }

        const HlsCtor = (window as any).Hls;
        if (HlsCtor && HlsCtor.isSupported?.()) {
          hls = new HlsCtor();
          hls.loadSource(finalUrl);
          hls.attachMedia(video);
          hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          return;
        }

        video.src = finalUrl;
        await video.play().catch(() => {});
      } catch {
        // ignore setup errors
      }
    };

    void setup();

    return () => {
      if (hls) {
        try {
          hls.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [finalUrl]);

  if (!finalUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-1 px-3 py-4 text-xs text-center rounded-md bg-slate-950/70 text-slate-300">
        <p>لا يوجد رابط تشغيل متاح للبث حالياً.</p>
        <p className="text-[10px] text-slate-500">
          يرجى التحقق من إعدادات البث أو ضبط قيمة VITE_PLAYBACK_BASE في النظام.
        </p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="object-contain w-full h-full bg-black rounded-md"
      controls
      playsInline
      autoPlay
      muted={kind !== "camera"}
    />
  );
};

export default BroadcastPlayer;
