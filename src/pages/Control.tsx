/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";
// ================================
// CONFIG
// ================================
const SIGNAL_SERVER = "http://localhost:5000";
const CHANNEL_ID = "global"; // same channel as dashboard

const Control: React.FC = () => {
  // ============================
  // socket / connection
  // ============================
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [lastDisconnect, setLastDisconnect] = useState<number | null>(null);

  // ============================
  // camera state
  // ============================
  const [showPrompt, setShowPrompt] = useState(false); // show warning before opening camera
  const [countdown, setCountdown] = useState<number | null>(null); // 7s
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraStreamId, setCameraStreamId] = useState<string | null>(null);

  // actual media
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // zoom
  const [zoom, setZoom] = useState(1);

  // ============================
  // HELPER: stop local camera (DRY)
  //  - stop tracks
  //  - clear video element
  //  - reset flags
  // ============================
  const stopLocalCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
    setCountdown(null);
    setShowPrompt(false);
  }, []);

  // ============================
  // SOCKET CONNECT
  // ============================
  useEffect(() => {
    // create socket
    const s = io(SIGNAL_SERVER, {
      transports: ["websocket"],
      autoConnect: true,
    });
    setSocket(s);
    // on connect
    s.on("connect", () => {
      setConnStatus("connected");
      setLastDisconnect(null);
      notifySignalConnected();
      // join as vehicle / device
      // server can distinguish by role
      s.emit("channel:join", {
        channelId: CHANNEL_ID,
        role: "vehicle",
      });
    });

    const handleDisconnect = () => {
      setConnStatus("disconnected");
      setLastDisconnect(Date.now());
      notifySignalDisconnected()
      // stop everything locally
      stopLocalCamera();
      stopRecording();
      setCameraStreamId(null);
    };

    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleDisconnect);

    // when server notifies about existing streams in channel
    s.on("channel:streams", (streams: any[]) => {
      // if our camera is already registered, keep its id
      const mine = streams.find(
        (st) => st.ownerId === s.id && st.kind === "camera"
      );
      if (mine) {
        setCameraStreamId(mine.streamId);
        // we don't auto-open local getUserMedia here
      } else {
        setCameraStreamId(null);
      }
    });

    // when our stream is registered on server
    s.on("stream:started", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id && p.kind === "camera") {
        setCameraStreamId(p.streamId);
      }
    });

    // when our stream is stopped by server
    s.on("stream:stopped", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id && p.kind === "camera") {
        // server stopped our camera → stop local
        stopLocalCamera();
        stopRecording();
        setCameraStreamId(null);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [stopLocalCamera]);

  // ============================
  // countdown effect (7s)
  // ============================
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      // time to open camera
      openCamera();
      setShowPrompt(false);
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : c));
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ============================
  // open camera with getUserMedia
  // ============================
  const openCamera = async () => {
    if (connStatus !== "connected") {
      // we can show a toast or alert
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: true,
      });

      cameraStreamRef.current = media;
      setIsCameraOn(true);

      // attach to video
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      // tell server we started camera
      socket?.emit("stream:start", {
        channelId: CHANNEL_ID,
        kind: "camera",
      });

      // if user stops camera from browser UI
      const track = media.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        handleStopCamera();
      });
    } catch (err) {
      console.error("[control] getUserMedia failed:", err);
      setShowPrompt(false);
      setCountdown(null);
      setIsCameraOn(false);
    }
  };

  // ============================
  // start camera button handler
  // ============================
  const handleStartClick = () => {
    // show prompt and start countdown
    setShowPrompt(true);
    setCountdown(7);
  };

  // ============================
  // stop camera (local + server)
  //  use server stream id if we have it
  // ============================
  const handleStopCamera = () => {
    // stop local
    stopLocalCamera();

    // tell server
    if (socket && cameraStreamId) {
      socket.emit("stream:stop", {
        channelId: CHANNEL_ID,
        streamId: cameraStreamId,
      });
    }
    setCameraStreamId(null);
  };

  // ============================
  // start recording (camera only)
  // ============================
  const startRecording = () => {
    if (!cameraStreamRef.current) return;
    const rec = new MediaRecorder(cameraStreamRef.current, {
      mimeType: "video/webm;codecs=vp8",
    });
    recorderRef.current = rec;
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
    };

    // 1s chunks → more stable recording
    rec.start(1000);
    setIsRecording(true);
  };

  // ============================
  // stop recording
  // ============================
  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  };

  // ============================
  // zoom handlers
  // ============================
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2.3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  // ============================
  // screenshot from video
  // ============================
  const handleScreenshot = () => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `screenshot-${Date.now()}.png`;
    a.click();
  };

  // ============================
  // send car command (updated shape)
  //  server expects { action: "forward", value?: ... }
  // ============================
  const sendCarCommand = (action: string, value?: unknown) => {
    socket?.emit("car-command", { action, value });
  };

  // ============================
  // cleanup on unmount
  // ============================
  useEffect(() => {
    return () => {
      stopLocalCamera();
      stopRecording();
    };
  }, [stopLocalCamera]);

  // ============================
  // UI helpers
  // ============================
  const serverStatusLabel =
    connStatus === "connected"
      ? "متصل بخادم الإشارة"
      : connStatus === "connecting"
      ? "جارٍ الاتصال بخادم الإشارة..."
      : "غير متصل بالخادم";

  const serverStatusColor =
    connStatus === "connected"
      ? "bg-emerald-500"
      : connStatus === "connecting"
      ? "bg-yellow-400"
      : "bg-red-500";

  // arrow icon
  const ArrowIcon = ({ dir }: { dir: "up" | "down" | "left" | "right" }) => {
    const rotation =
      dir === "up"
        ? "rotate-0"
        : dir === "right"
        ? "rotate-90"
        : dir === "down"
        ? "rotate-180"
        : "-rotate-90";
    return (
      <svg
        className={`w-8 h-8 ${rotation}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        fill="none"
      >
        <path
          d="M12 5l6 6M12 5L6 11"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 5v14"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const CameraIcon = () => (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      className="text-slate-200"
    >
      <path
        d="M7 7h2l1-1h4l1 1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
        strokeWidth="1.3"
      />
      <circle cx="12" cy="12" r="3.3" strokeWidth="1.3" />
    </svg>
  );

  const IconRec = ({ active = false }: { active?: boolean }) => (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full ${
        active ? "bg-red-400 animate-pulse" : "bg-slate-500"
      }`}
    />
  );

  return (
    <div className="relative space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            غرفة تحكّم المركبة
          </h2>
          <p className="text-sm text-slate-400">
            بث الكاميرا من المركبة + أوامر الحركة + تسجيل.
          </p>
        </div>
        <div className="flex gap-2">
          {!isCameraOn ? (
            <button
              onClick={handleStartClick}
              disabled={connStatus !== "connected"}
              className="px-4 py-2 text-sm text-white rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700/40 disabled:text-slate-500"
            >
              تشغيل الكاميرا
            </button>
          ) : (
            <button
              onClick={handleStopCamera}
              className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600"
            >
              إيقاف
            </button>
          )}

          {isCameraOn && !isRecording && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-md bg-slate-700 hover:bg-slate-600"
            >
              <IconRec />
              تسجيل
            </button>
          )}

          {isCameraOn && isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-orange-500 rounded-md hover:bg-orange-600"
            >
              <IconRec active />
              إيقاف التسجيل
            </button>
          )}
        </div>
      </div>

      {/* connection box */}
      <div className="flex items-center gap-2 p-3 border rounded-md bg-slate-900/50 border-slate-800">
        <span className={`w-3 h-3 rounded-full ${serverStatusColor}`} />
        <span className="text-sm text-white">{serverStatusLabel}</span>
        {lastDisconnect && (
          <span className="text-[10px] text-slate-500 ml-auto">
            آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* prompt */}
      {showPrompt && (
        <div className="flex items-center justify-between gap-3 p-4 border rounded-md bg-amber-500/10 border-amber-400/50">
          <div>
            <p className="text-sm font-medium text-amber-50">
              سيتم طلب صلاحية الكاميرا والمايك.
            </p>
            <p className="text-xs text-amber-200">
              سيتم التشغيل خلال {countdown}s ...
            </p>
          </div>
          <button
            onClick={() => {
              setShowPrompt(false);
              setCountdown(null);
            }}
            className="px-3 py-1 text-xs text-white rounded-md bg-amber-500/80"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* camera block */}
      <div className="p-4 space-y-5 border rounded-lg bg-slate-900/50 border-slate-800">
        <h3 className="mb-1 text-sm font-semibold text-white">
          معاينة الكاميرا
        </h3>

        <div className="w-full max-w-3xl mx-auto">
          <div className="relative rounded-lg overflow-hidden bg-slate-950/30 flex items-center justify-center h-[270px] md:h-[330px]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="object-cover w-full h-full transition-transform will-change-transform"
              style={{ transform: `scale(${zoom})` }}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/45 backdrop-blur-sm">
                <div className="flex items-center justify-center border rounded-full shadow-lg h-14 w-14 bg-slate-900/70 border-slate-700/50">
                  <CameraIcon />
                </div>
                <p className="text-sm text-slate-200">
                  لا يوجد بث كاميرا حالياً
                </p>
                <p className="text-xs text-slate-500">
                  اضغط “تشغيل الكاميرا” للبدء
                </p>
              </div>
            )}
            {isRecording && (
              <div className="absolute flex items-center gap-2 px-3 py-1 text-xs text-white rounded-full top-3 left-3 bg-red-500/85">
                <IconRec active />
                تسجيل جارٍ
              </div>
            )}
          </div>
        </div>

        {/* zoom controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
          <span className="mr-2 text-xs text-slate-400">التكبير:</span>
          <button
            onClick={handleZoomOut}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs"
          >
            تصغير
          </button>
          <button
            onClick={handleZoomIn}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs"
          >
            تكبير
          </button>
          <button
            onClick={handleZoomReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs"
          >
            إعادة الضبط
          </button>
          <span className="text-xs text-slate-500">
            {(zoom * 100).toFixed(0)}%
          </span>
        </div>

        {/* vehicle controls */}
        <div className="pt-2">
          <h4 className="mb-3 text-xs text-slate-400">تحكم المركبة</h4>
          <div className="grid grid-cols-3 gap-4 mx-auto w-fit justify-items-center">
            {/* row 1 */}
            <div />
            <button
              onMouseDown={() => sendCarCommand("forward")}
              onMouseUp={() => sendCarCommand("stop")}
              onTouchStart={() => sendCarCommand("forward")}
              onTouchEnd={() => sendCarCommand("stop")}
              className="flex flex-col items-center justify-center text-white transition shadow-md h-14 w-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95"
            >
              <ArrowIcon dir="up" />
            </button>
            <div />

            {/* row 2 */}
            <button
              onMouseDown={() => sendCarCommand("left")}
              onMouseUp={() => sendCarCommand("stop")}
              onTouchStart={() => sendCarCommand("left")}
              onTouchEnd={() => sendCarCommand("stop")}
              className="flex items-center justify-center text-white transition shadow-md h-14 w-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95"
            >
              <ArrowIcon dir="left" />
            </button>

            {/* center = screenshot */}
            <button
              onClick={handleScreenshot}
              disabled={!isCameraOn}
              className={`h-16 w-16 rounded-full ${
                !isCameraOn
                  ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white"
              } flex flex-col items-center justify-center shadow-lg border border-emerald-200/30`}
            >
              <svg
                className="w-5 h-5 mb-0.5"
                viewBox="0 0 24 24"
                stroke="currentColor"
                fill="none"
              >
                <path
                  d="M9 7h1l1-1h2l1 1h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"
                  strokeWidth="1.3"
                />
                <circle cx="12" cy="12" r="2.6" strokeWidth="1.2" />
              </svg>
              <span className="text-[9px] uppercase">shot</span>
            </button>

            <button
              onMouseDown={() => sendCarCommand("right")}
              onMouseUp={() => sendCarCommand("stop")}
              onTouchStart={() => sendCarCommand("right")}
              onTouchEnd={() => sendCarCommand("stop")}
              className="flex items-center justify-center text-white transition shadow-md h-14 w-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95"
            >
              <ArrowIcon dir="right" />
            </button>

            {/* row 3 */}
            <div />
            <button
              onMouseDown={() => sendCarCommand("backward")}
              onMouseUp={() => sendCarCommand("stop")}
              onTouchStart={() => sendCarCommand("backward")}
              onTouchEnd={() => sendCarCommand("stop")}
              className="flex items-center justify-center text-white transition shadow-md h-14 w-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95"
            >
              <ArrowIcon dir="down" />
            </button>
            <div />
          </div>
        </div>

        {/* recorded video link */}
        {recordedUrl && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-400">ملف التسجيل:</p>
            <a
              href={recordedUrl}
              download="camera-recording.webm"
              className="inline-flex items-center gap-2 text-xs underline text-emerald-400"
            >
              تنزيل التسجيل
              <span aria-hidden>↓</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Control;
