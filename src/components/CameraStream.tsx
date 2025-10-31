/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { gsap } from "gsap";

interface CameraStreamProps {
  signalServer?: string;
  onShareScreen?: (isSharing: boolean) => void;
}

export default function CameraStream({
  signalServer = import.meta.env.VITE_SIGNAL_SERVER || "http://localhost:56211",
  onShareScreen,
}: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isSharing, setIsSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // connect to signaling server
  useEffect(() => {
    const s = io(signalServer, { transports: ["websocket"] });

    s.on("connect", () => {
      setError(null);
      setLoading(true);
      setTimeout(() => {
        setConnected(true);
        setLoading(false);
      }, 800);
    });

    s.on("disconnect", () => {
      setConnected(false);
      setLoading(true);
    });

    setSocket(s);

    // 🚩 IMPORTANT: don't return s.disconnect() directly
    return () => {
      s.disconnect(); // this returns Socket, but we ignore it here
    };
  }, [signalServer]);

  // zoom animation
  useEffect(() => {
    if (videoRef.current) {
      gsap.to(videoRef.current, {
        scale: zoom,
        duration: 0.25,
        ease: "power2.out",
      });
    }
  }, [zoom]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    if (videoRef.current) {
      gsap.to(videoRef.current, {
        scale: 1,
        duration: 0.4,
        ease: "elastic.out(1, 0.6)",
      });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const stopTracks = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const toggleScreenShare = async () => {
    if (isSharing) {
      stopTracks();
      setIsSharing(false);
      onShareScreen?.(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsSharing(true);
      onShareScreen?.(true);
    } catch (err) {
      console.error(err);
      setError("تعذر مشاركة الشاشة");
    }
  };

  // SVG helpers
  const IconMinus = () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path d="M5 12h14" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
  const IconPlus = () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path d="M12 5v14M5 12h14" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
  const IconReset = () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path
        d="M4 4v6h6"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 13a7 7 0 1 0 2-5"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  const IconShare = () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path
        d="M4 12v7a1 1 0 0 0 1 1h5"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 17 20 7"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 7h6v6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  const IconMax = () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path
        d="M8 4H4v4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 4h4v4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16v4h4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 16v4h-4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  const IconMin = () => (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path
        d="M9 15H4v5h5v-5Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4h-5v5h5V4Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-2xl mx-auto overflow-hidden border border-gray-800 shadow-lg camera-stream rounded-xl bg-gray-900/70"
    >
      {/* status bar */}
      <div className="absolute z-20 flex items-center justify-between gap-3 top-3 left-3 right-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-white/80">
            {loading
              ? "جار الاتصال بالكاميرا..."
              : connected
              ? "الكاميرا متصلة"
              : "الكاميرا غير متصلة"}
          </span>
          {isSharing && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/90 text-white">
              Sharing
            </span>
          )}
          {error && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/90 text-white">
              {error}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
            onClick={handleZoomOut}
            aria-label="تصغير"
          >
            <IconMinus />
          </button>
          <button
            type="button"
            className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
            onClick={handleZoomIn}
            aria-label="تكبير"
          >
            <IconPlus />
          </button>
          <button
            type="button"
            className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
            onClick={handleResetZoom}
            aria-label="إعادة الضبط"
          >
            <IconReset />
          </button>
          <button
            type="button"
            className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
            onClick={toggleScreenShare}
            aria-label="مشاركة الشاشة"
          >
            <IconShare />
          </button>
          <button
            type="button"
            className="p-2 text-white transition-colors rounded-md bg-white/10 hover:bg-white/20"
            onClick={toggleFullscreen}
            aria-label="ملء الشاشة"
          >
            {isFullscreen ? <IconMin /> : <IconMax />}
          </button>
        </div>
      </div>

      {/* video */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-slate-900 to-slate-800">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/70">
            <div className="w-12 h-12 border-2 rounded-full border-white/30 border-t-white/90 animate-spin" />
            <p className="text-sm">نجهز الكاميرا لك...</p>
          </div>
        ) : !connected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white/70">
            <div className="p-4 border rounded-full bg-red-500/10 border-red-400/50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-red-300"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 9v3.75m-9.303 3.376L10.53 3.53a1.875 1.875 0 013.338 0l7.834 12.596A1.875 1.875 0 0120.084 20.5H3.916a1.875 1.875 0 01-1.219-3.374z"
                />
              </svg>
            </div>
            <p>الكاميرا غير متصلة</p>
            <button
              type="button"
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm flex items-center gap-2"
              onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  setConnected(true);
                  setLoading(false);
                }, 800);
              }}
            >
              <IconReset />
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="object-cover w-full h-full transition-transform will-change-transform"
            style={{ transform: `scale(${zoom})` }}
          />
        )}
      </div>

      {/* bottom bar for mobile */}
      {isMobile && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/30 backdrop-blur-sm">
          <span className="text-xs text-white/60">
            Zoom: {(zoom * 100).toFixed(0)}%
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleZoomOut}
              className="flex items-center justify-center w-8 h-8 text-sm text-white rounded-full bg-white/10"
            >
              -
            </button>
            <button
              onClick={handleZoomIn}
              className="flex items-center justify-center w-8 h-8 text-sm text-white rounded-full bg-white/10"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
