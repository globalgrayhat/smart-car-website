/**
 * LiveTile
 * - Single media tile for mediasoup producer
 * - Primary video pairs hidden audio by peerId (no audio-only tiles)
 * - Optional zoom controls
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
    typeof media?.bindRemote === "function" ? (media.bindRemote as (id: string, el: HTMLMediaElement | null) => void) : null;
  const bindPeerAudio =
    typeof media?.bindPeerAudio === "function" ? (media.bindPeerAudio as (peerId: string, el: HTMLAudioElement | null) => void) : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!bindRemote) return;
    if (kind === "video" && videoRef.current) bindRemote(producerId, videoRef.current);
    if (kind === "audio" && audioRef.current) bindRemote(producerId, audioRef.current);
  }, [bindRemote, producerId, kind]);

  useEffect(() => {
    if (!isPrimary || !peerId || !bindPeerAudio) return;
    if (audioRef.current) bindPeerAudio(peerId, audioRef.current);
  }, [isPrimary, peerId, bindPeerAudio]);

  if (kind === "audio") {
    // We generally don't render audio-only tiles
    return null;
  }

  const chromeTop = hideChrome ? null : (
    <div className="absolute z-10 flex items-center gap-2 top-2 left-2">
      <span className="px-2 py-[2px] text-[10px] rounded bg-red-500 text-white shadow">LIVE</span>
      {title ? (
        <span className="px-2 py-[2px] text-[10px] rounded bg-slate-900/80 text-slate-100">
          {title}
        </span>
      ) : null}
    </div>
  );

  const chromeBottom = hideChrome ? null : (
    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
      <p className="text-[10px] text-slate-200">
        producer: <span className="opacity-70">{producerId}</span>
      </p>
    </div>
  );

  const zoomControls =
    zoomable && !hideChrome ? (
      <div className="absolute z-10 flex items-center gap-1 bottom-2 right-2">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
          className="px-2 py-1 text-[10px] rounded bg-slate-900/80 text-slate-100 border border-slate-700"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-2 py-1 text-[10px] rounded bg-slate-900/80 text-slate-100 border border-slate-700"
          aria-label="Reset zoom"
        >
          1x
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)))}
          className="px-2 py-1 text-[10px] rounded bg-slate-900/80 text-slate-100 border border-slate-700"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    ) : null;

  if (isPrimary) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-slate-950/40 border border-slate-800 aspect-video ${className}`}>
        {chromeTop}
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            className="object-contain w-full h-full bg-black"
            muted
            playsInline
            autoPlay
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          />
        </div>
        {/* Hidden audio: pairs the sound with the primary video */}
        <audio ref={audioRef} className="hidden" autoPlay />
        {zoomControls}
        {chromeBottom}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-black border rounded-xl border-slate-800 ${className}`}>
      <div className="relative aspect-video bg-slate-950">
        <video ref={videoRef} className="object-contain w-full h-full" muted playsInline autoPlay />
        {title ? (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50">
            <p className="text-[10px] text-slate-100 truncate">{title}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
