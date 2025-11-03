// src/components/BroadcastPlayer.tsx
import React, { useEffect, useRef } from "react";

type BroadcastPlayerProps = {
  // explicit full url from backend
  src?: string | null;
  // maybe backend already gave us playbackUrl
  playbackUrl?: string | null;
  // fallback info
  streamId?: string | null;
  ownerId?: string | null;
  kind?: "camera" | "screen" | "custom";
};

/**
 * Generic player (safe version):
 * - try: src
 * - then: playbackUrl
 * - then: VITE_PLAYBACK_BASE + streamId   ← instead of /api/broadcast/play/:id
 * - if nothing → show placeholder
 *
 * NOTE:
 * - This does NOT call /api/broadcast/play/:id anymore because backend doesn’t have it.
 * - Define VITE_PLAYBACK_BASE=http://localhost:8000/hls (مثلاً) لو عندك سيرفر بث مستقل.
 */
const BroadcastPlayer: React.FC<BroadcastPlayerProps> = ({
  src,
  playbackUrl,
  streamId,
  ownerId, // not used now, لكن خله يمكن تحتاجه بعدين
  kind = "camera",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // optional base, e.g. http://localhost:8000/hls
  const PLAYBACK_BASE =
    import.meta.env.VITE_PLAYBACK_BASE &&
    import.meta.env.VITE_PLAYBACK_BASE.trim().replace(/\/+$/, "");

  // build final url – all safe
  const finalUrl =
    src ||
    playbackUrl ||
    (PLAYBACK_BASE && streamId
      ? `${PLAYBACK_BASE}/${streamId}.m3u8`
      : null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !finalUrl) return;

    // native HLS
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = finalUrl;
      video.play().catch(() => {});
      return;
    }

    // hls.js support (if loaded globally)
    const HlsCtor = (window as any).Hls;
    if (HlsCtor) {
      const hls = new HlsCtor();
      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => {
        hls.destroy();
      };
    }

    // normal mp4 / webm
    video.src = finalUrl;
    video.play().catch(() => {});
  }, [finalUrl]);

  if (!finalUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-1 text-xs rounded-md bg-slate-950/60 text-slate-400">
        <p>No playback URL available.</p>
        <p className="text-[10px] text-slate-500">
          Backend didn’t expose a broadcast play endpoint.
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
