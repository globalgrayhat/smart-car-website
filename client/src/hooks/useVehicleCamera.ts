/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useVehicleCamera
 * - Thin hook over MediaContext to control local camera preview
 * - Stable stream id via localStorage (so on/off returns same broadcast)
 * - No custom payload fields that break types
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useMedia } from "../media/MediaContext";

const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || "global";

export function useVehicleCamera() {
  const media = useMedia() as any;

  const socket = media?.socket ?? null;
  const connStatus: "connected" | "connecting" | "disconnected" =
    media?.connStatus ?? "disconnected";
  const streams: any[] = Array.isArray(media?.streams) ? media.streams : [];
  const camera = media?.camera ?? null;
  const lastDisconnect: number | null = media?.lastDisconnect ?? null;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);
  const [showRemotePicker, setShowRemotePicker] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Local recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Remote cams in same channel (optional)
  const myId = socket?.id;
  const remoteCams = streams.filter((s) => s.kind === "camera" && s.ownerId !== myId);
  const hasRemoteCamera = remoteCams.length > 0;
  const primaryRemote: any = hasRemoteCamera ? remoteCams[0] : null;

  // Bind context camera to this hook video
  useEffect(() => {
    if (videoRef.current && camera?.bindVideo) {
      camera.bindVideo(videoRef.current);
    }
  }, [camera]);

  // Actually start local camera (calls MediaContext.camera.start)
  const startLocalCamera = useCallback(async () => {
    if (connStatus !== "connected") return;
    if (!camera?.start) return;
    await camera.start({ withAudio: true });
    setHasStartedOnce(true);
  }, [camera, connStatus]);

  // Ask user before starting camera (first time)
  const requestStartCamera = () => {
    if (camera?.isOn) return;
    if (!hasStartedOnce) {
      setShowPrompt(true);
      setCountdown(3);
    } else {
      void startLocalCamera();
    }
  };

  // Countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      void startLocalCamera();
      setShowPrompt(false);
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : c));
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown, startLocalCamera]);

  // Stop local camera
  const stopCamera = () => {
    camera?.stop?.();
    setShowPrompt(false);
    setCountdown(null);
  };

  // Stop remote camera (same channel)
  const stopRemoteCamera = (streamId?: string | null) => {
    if (!socket || connStatus !== "connected") return;
    const target = streamId || primaryRemote?.streamId;
    if (!target) return;
    socket.emit("stream:stop", { channelId: CHANNEL_ID, streamId: target });
  };

  // Local recording from preview
  const startRecording = () => {
    const v = videoRef.current;
    const src = (v?.srcObject as MediaStream) || null;
    if (!v || !src) return;
    const rec = new MediaRecorder(src, { mimeType: "video/webm;codecs=vp8" });
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(url);
    };
    rec.start(1000);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
  };
  const requestRemoteDeviceCamera = (ownerId: string) => {
    if (!socket || connStatus !== "connected") return;
    socket.emit("device:camera:request", { channelId: CHANNEL_ID, targetId: ownerId });
    setShowRemotePicker(false);
  };

  const sendCarCommand = (action: string, value?: unknown) => {
    if (!socket || connStatus !== "connected") return;
    socket.emit("car-command", { action, value });
  };
  // Screenshot from preview
  const handleScreenshot = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `vehicle-camera-${Date.now()}.png`;
    a.click();
  };

  // Zoom helpers
  const zoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)));
  const zoomReset = () => setZoom(1);

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  return {
    videoRef,
    connStatus,
    lastDisconnect,
    isCameraOn: !!camera?.isOn,
    micMuted: !!camera?.micMuted,
    toggleMic: camera?.toggleMic?.bind(camera) || (() => {}),
    showPrompt,
    countdown,
    isRemoteCamera: hasRemoteCamera,
    remoteLabel: primaryRemote ? `Remote camera (${String(primaryRemote.ownerId).slice(0, 5)}…)` : null,
    remoteStreamId: primaryRemote?.streamId || null,
    remoteDevices: remoteCams,
    // recording
    isRecording,
    recordedUrl,
    startRecording,
    stopRecording,
    showRemotePicker,
    setShowRemotePicker,
    requestRemoteDeviceCamera,
    // zoom
    zoom,
    zoomIn,
    zoomOut,
    zoomReset,
    // actions
    requestStartCamera,
    stopCamera,
    stopRemoteCamera,
    handleScreenshot,
    sendCarCommand
  };
}
