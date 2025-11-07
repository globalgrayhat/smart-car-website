/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LiveTile
 *
 * Renders a remote Mediasoup producer (video/audio) and binds it to a DOM element.
 * - For primary tiles: video + peer audio (unified broadcast experience).
 * - For secondary tiles: muted video previews only.
 */

import React, { useEffect, useRef, useState } from "react";
import { useMedia } from "../media/MediaContext";

type LiveTileProps = {
  producerId: string;
  kind: "video" | "audio";
  title?: string;
  isPrimary?: boolean;
  hideChrome?: boolean;
  zoomable?: boolean;
  peerId?: string;
  className?: string;
};

export const LiveTile: React.FC<LiveTileProps> = ({
  producerId,
  kind,
  title,
  isPrimary = false,
  hideChrome = false,
  zoomable = false,
  peerId,
  className = "",
}) => {
  const media = useMedia() as any;

  const bindRemote =
    typeof media?.bindRemote === "function"
      ? (media.bindRemote as (id: string, el: HTMLMediaElement | null) => void)
      : null;

  const bindPeerAudio =
    typeof media?.bindPeerAudio === "function"
      ? (media.bindPeerAudio as (peerId: string, el: HTMLAudioElement | null) => void)
      : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [zoom, setZoom] = useState(1);

  /**
   * Bind the producer stream (video/audio) to the corresponding media element.
   */
  useEffect(() => {
    if (!bindRemote) return;

    const el =
      kind === "video"
        ? videoRef.current
        : kind === "audio"
        ? audioRef.current
        : null;

    if (!el) return;

    bindRemote(producerId, el);

    const tryPlay = () => {
      el.play().catch(() => {
        // Autoplay can be blocked; ignore silently.
      });
    };

    tryPlay();
    el.addEventListener("canplay", tryPlay, { once: true });

    return () => {
      el.removeEventListener("canplay", tryPlay);
    };
  }, [bindRemote, producerId, kind]);

  /**
   * For the primary tile: bind unified peer audio once.
   */
  useEffect(() => {
    if (!isPrimary || !peerId || !bindPeerAudio || !audioRef.current) return;
    bindPeerAudio(peerId, audioRef.current);
  }, [isPrimary, peerId, bindPeerAudio]);

  // Do not render standalone audio tiles for non-primary.
  if (kind === "audio" && !isPrimary) return null;

  const chromeTop = hideChrome ? null : (
    <div className="absolute z-10 flex flex-wrap items-center gap-2 top-2 left-2">
      <span className="px-2 py-[2px] text-[9px] md:text-[10px] rounded bg-red-500 text-white shadow">
        مباشر
      </span>
      {title && (
        <span className="px-2 py-[2px] text-[9px] md:text-[10px] rounded bg-slate-900/80 text-slate-100 max-w-[60vw] md:max-w-xs truncate">
          {title}
        </span>
      )}
    </div>
  );

  const chromeBottom = hideChrome ? null : (
    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
      <p className="text-[8px] md:text-[10px] text-slate-200">
        المعرّف: <span className="break-all opacity-70">{producerId}</span>
      </p>
    </div>
  );

  const zoomControls =
    zoomable && !hideChrome ? (
      <div className="absolute z-10 flex items-center gap-1 bottom-2 right-2">
        <button
          onClick={() =>
            setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))
          }
          className="px-2 py-1 text-[9px] md:text-[10px] rounded bg-slate-900/80 text-slate-100 border border-slate-700"
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-2 py-1 text-[9px] md:text-[10px] rounded bg-slate-900/80 text-slate-100 border border-slate-700"
        >
          ١×
        </button>
        <button
          onClick={() =>
            setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)))
          }
          className="px-2 py-1 text-[9px] md:text-[10px] rounded bg-slate-900/80 text-slate-100 border border-slate-700"
        >
          +
        </button>
      </div>
    ) : null;

  // PRIMARY TILE: يكون مرن ويعتمد على الحاوية الأم، مع حد أقصى مناسب للشاشات
  if (isPrimary) {
    return (
      <div
        className={`
          relative overflow-hidden rounded-lg bg-slate-950/40 border border-slate-800
          w-full h-full min-h-[180px] max-h-[70vh]
          ${className}
        `}
      >
        {chromeTop}
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            className="object-contain w-full h-full bg-black"
            muted
            playsInline
            autoPlay
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        </div>
        <audio ref={audioRef} className="hidden" autoPlay />
        {zoomControls}
        {chromeBottom}
      </div>
    );
  }

  // ثانوي / معاينة صغيرة
  return (
    <div
      className={`
        overflow-hidden bg-black border rounded-xl border-slate-800
        ${className}
      `}
    >
      <div className="relative aspect-video bg-slate-950">
        <video
          ref={videoRef}
          className="object-cover w-full h-full"
          muted
          playsInline
          autoPlay
        />
        {title && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50">
            <p className="text-[9px] md:text-[10px] text-slate-100 truncate">
              {title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
