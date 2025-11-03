// frontend/src/components/camera/CameraStream.tsx
// CameraStream: show local camera from MediaContext and control it
// - no more custom hook (useCameraStream) → we rely on MediaContext only
// - works with signal server via context (socket already connected there)
// - keeps same UI components you already built

import React, { useEffect, useRef, useState } from "react";
import { useMedia } from "../../media/MediaContext";
import CameraStatusBar from "./CameraStatusBar";
import CameraControls from "./CameraControls";
import CameraVideoSurface from "./CameraVideoSurface";
import CameraMobileBar from "./CameraMobileBar";
import { IconReset } from "./CameraIcons";

interface CameraStreamProps {
  // kept for compatibility, but we don't use it anymore
  signalServer?: string;
  // notify parent when camera started/stopped
  onShareScreen?: (isSharing: boolean) => void;
}

const CameraStream: React.FC<CameraStreamProps> = ({
  onShareScreen,
}) => {
  // take everything from media/signal context
  // expected shape: { camera, connStatus, socket, ... }
  const media = useMedia() as any;
  const camera = media?.camera;
  const connStatus: "connected" | "connecting" | "disconnected" =
    media?.connStatus ?? "disconnected";

  // refs for video + container (for fullscreen)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // local UI state (not from context)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // detect mobile once
  useEffect(() => {
    const check = () => {
      const m =
        window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(m);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // bind context camera to our video
  useEffect(() => {
    if (camera && typeof camera.bindVideo === "function" && videoRef.current) {
      camera.bindVideo(videoRef.current);
    }
  }, [camera]);

  // start local camera from context
  const handleShare = async () => {
    // must be connected to signal server first
    if (connStatus !== "connected") {
      setError("signal server is not connected");
      return;
    }
    // if camera already on → stop
    if (camera?.isOn) {
      camera.stop?.();
      onShareScreen?.(false);
      return;
    }
    // else start it
    try {
      setLoading(true);
      setError(null);
      await camera.start?.({
        withAudio: true,
      });
      onShareScreen?.(true);
    } catch (e) {
      console.error(e);
      setError("failed to start camera");
      onShareScreen?.(false);
    } finally {
      setLoading(false);
    }
  };

  // zoom handlers (UI only)
  const handleZoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)));
  const handleZoomOut = () =>
    setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)));
  const handleResetZoom = () => setZoom(1);

  // fullscreen (client-side)
  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // retry just re-binds / re-starts camera
  const handleRetry = () => {
    setError(null);
    // if camera is off → try turning it on
    if (!camera?.isOn) {
      void handleShare();
    } else if (camera?.bindVideo && videoRef.current) {
      // else just rebind
      camera.bindVideo(videoRef.current);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-2xl mx-auto overflow-hidden border border-gray-800 shadow-lg camera-stream rounded-xl bg-gray-900/70"
    >
      {/* top status bar: connection + errors + onAir status */}
      <CameraStatusBar
        connected={connStatus === "connected"}
        loading={loading}
        error={error}
        // map "isSharing" to "camera is on"
        isSharing={!!camera?.isOn}
      />

      {/* main controls */}
      <CameraControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleResetZoom}
        onShare={handleShare}
        onFullscreen={handleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* video area */}
      <CameraVideoSurface
        loading={loading}
        connected={connStatus === "connected"}
        zoom={zoom}
        videoRef={videoRef}
        onRetry={handleRetry}
        onResetIcon={<IconReset />}
      />

      {/* mobile bottom bar (just zoom) */}
      <CameraMobileBar
        isMobile={isMobile}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
    </div>
  );
};

export default CameraStream;
