/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import CarControls from "../components/CarControls";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";
// ==========================================
// CONFIG
// ==========================================
const SIGNAL_SERVER = import.meta.env.VITE_SIGNAL_SERVER || "http://localhost:56211";
const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID;

// ==========================================
// ICONS
// ==========================================
const IconCamera: React.FC = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    stroke="currentColor"
    fill="none"
  >
    <path
      d="M7 7h2l1-1h4l1 1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
      strokeWidth="1.3"
    />
    <circle cx="12" cy="12" r="3" strokeWidth="1.3" />
  </svg>
);

const IconScreen: React.FC = () => (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    stroke="currentColor"
    fill="none"
  >
    <rect x="3" y="4" width="18" height="12" rx="2" strokeWidth="1.4" />
    <path d="M10 20h4" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const IconRec: React.FC<{ active?: boolean }> = ({ active = false }) => (
  <span
    className={`inline-flex h-2.5 w-2.5 rounded-full ${
      active ? "bg-red-400 animate-pulse" : "bg-slate-500"
    }`}
  />
);

const Home: React.FC = () => {
  // ========================================
  // SOCKET STATE
  // ========================================
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [lastDisconnect, setLastDisconnect] = useState<number | null>(null);

  // ========================================
  // STREAM STATE
  // ========================================
  // our streams (admin)
  const [screenId, setScreenId] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [isScreenLive, setIsScreenLive] = useState(false);

  // vehicle camera (other client)
  const [vehicleCameraOwner, setVehicleCameraOwner] = useState<string | null>(
    null
  );

  // local media refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // UI flags
  const [screenOn, setScreenOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [direction, setDirection] = useState("");

  // battery (mock)
  const [batteryLevel, setBatteryLevel] = useState(80);

  // camera countdown + zoom
  const [cameraCountdown, setCameraCountdown] = useState<number | null>(null);
  const [cameraZoom, setCameraZoom] = useState(1);

  // video elements
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  // recording
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<Blob[]>([]);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [screenRecordUrl, setScreenRecordUrl] = useState<string | null>(null);

  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraChunksRef = useRef<Blob[]>([]);
  const [isCameraRecording, setIsCameraRecording] = useState(false);
  const [cameraRecordUrl, setCameraRecordUrl] = useState<string | null>(null);

  // ========================================
  // HELPER: stop local screen (DRY)
  // ========================================
  const stopLocalScreen = useCallback(() => {
    // stop tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    // reset UI
    setScreenOn(false);
    setIsScreenLive(false);
    // clear video
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
  }, []);

  // ========================================
  // HELPER: stop local camera (DRY)
  // ========================================
  const stopLocalCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraOn(false);
    setCameraCountdown(null);
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  // ========================================
  // detect mobile
  // ========================================
  useEffect(() => {
    const check = () => {
      const mobile =
        window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ========================================
  // fake battery (mock)
  // ========================================
  useEffect(() => {
    const id = setInterval(() => {
      setBatteryLevel((prev) => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return Math.max(10, Math.min(100, Math.round(next)));
      });
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // ========================================
  // SOCKET
  // ========================================
  useEffect(() => {
    const s = io(SIGNAL_SERVER, {
      transports: ["websocket"],
      autoConnect: true,
    });
    setSocket(s);

    // connected
    s.on("connect", () => {
      setConnStatus("connected");
      setLastDisconnect(null);
      notifySignalConnected();
      s.emit("channel:join", { channelId: CHANNEL_ID, role: "control" });
    });

    // disconnected / server down
    s.on("disconnect", () => {
      setConnStatus("disconnected");
      setLastDisconnect(Date.now());
      notifySignalDisconnected();
      // stop everything locally
      stopLocalScreen();
      stopLocalCamera();
      stopScreenRecording();
      stopCameraRecording();
      setVehicleCameraOwner(null);
    });

    s.on("connect_error", () => {
      setConnStatus("disconnected");
      setLastDisconnect(Date.now());
      stopLocalScreen();
      stopLocalCamera();
      stopScreenRecording();
      stopCameraRecording();
      setVehicleCameraOwner(null);
    });

    // initial streams
    s.on("channel:streams", (streams: any[]) => {
      setVehicleCameraOwner(null);

      streams.forEach((st) => {
        if (st.ownerId === s.id) {
          // our streams
          if (st.kind === "screen") {
            setScreenId(st.streamId);
            if (st.isLive) setIsScreenLive(true);
          }
          if (st.kind === "camera") {
            setCameraId(st.streamId);
          }
        } else {
          // vehicle stream
          if (st.kind === "camera") setVehicleCameraOwner(st.ownerId);
        }
      });
    });

    // someone started a stream
    s.on("stream:started", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      // ours
      if (p.ownerId === s.id) {
        if (p.kind === "screen") setScreenId(p.streamId);
        if (p.kind === "camera") setCameraId(p.streamId);
      } else {
        // vehicle
        if (p.kind === "camera") setVehicleCameraOwner(p.ownerId);
      }
    });

    // someone stopped a stream
    s.on("stream:stopped", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;

      // our streams
      if (p.ownerId === s.id) {
        if (p.kind === "screen") {
          stopLocalScreen();
          setScreenId(null);
          stopScreenRecording();
        }
        if (p.kind === "camera") {
          stopLocalCamera();
          setCameraId(null);
          stopCameraRecording();
        }
      } else {
        // vehicle
        if (p.kind === "camera") setVehicleCameraOwner(null);
      }
    });

    // broadcast started
    s.on("stream:broadcast:started", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id) {
        setIsScreenLive(true);
      }
    });

    // broadcast stopped
    s.on("stream:broadcast:stopped", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id) {
        setIsScreenLive(false);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [stopLocalScreen, stopLocalCamera]);

  // ========================================
  // broadcast qualities (helper)
  // ========================================
  const announceQualities = useCallback(() => {
    if (!socket) return;
    socket.emit("broadcast:qualities", {
      channelId: CHANNEL_ID,
      qualities: [
        { id: "low", label: "360p", width: 640, height: 360 },
        { id: "med", label: "540p", width: 960, height: 540 },
        { id: "high", label: "720p", width: 1280, height: 720 },
      ],
    });
  }, [socket]);

  // ========================================
  // SCREEN start/stop
  // ========================================
  const startScreen = async () => {
    if (connStatus !== "connected") return;
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: isMobile
          ? { width: { ideal: 430 }, height: { ideal: 900 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      screenStreamRef.current = media;
      setScreenOn(true);

      socket?.emit("stream:start", {
        channelId: CHANNEL_ID,
        kind: "screen",
      });
      announceQualities();

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = media;
        screenVideoRef.current.muted = true;
        screenVideoRef.current.play().catch(() => {});
      }

      // if user stops from browser
      const track = media.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        stopScreen();
      });
    } catch (err) {
      console.error("screen err", err);
    }
  };

  const stopScreen = () => {
    stopLocalScreen();
    if (socket && screenId) {
      socket.emit("stream:stop", {
        channelId: CHANNEL_ID,
        streamId: screenId,
      });
    }
  };

  // ========================================
  // SCREEN broadcast
  // ========================================
  const startBroadcast = () => {
    if (!socket || !screenOn || !screenId) return;
    socket.emit("stream:broadcast:start", {
      channelId: CHANNEL_ID,
      streamId: screenId,
    });
    setIsScreenLive(true);
  };

  const stopBroadcast = () => {
    if (!socket || !screenId) return;
    socket.emit("stream:broadcast:stop", {
      channelId: CHANNEL_ID,
      streamId: screenId,
    });
    setIsScreenLive(false);
  };

  // ========================================
  // CAMERA with countdown
  // ========================================
  const actuallyOpenCamera = async () => {
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
      setCameraOn(true);

      socket?.emit("stream:start", {
        channelId: CHANNEL_ID,
        kind: "camera",
      });
      announceQualities();

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = media;
        cameraVideoRef.current.muted = true;
        cameraVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("camera err", err);
      setCameraCountdown(null);
    }
  };

  const startCamera = () => {
    if (connStatus !== "connected") return;
    // if vehicle is broadcasting camera → admin camera disabled
    if (vehicleCameraOwner) return;
    if (cameraOn) return;
    if (cameraCountdown !== null) return;
    // 3 seconds countdown
    setCameraCountdown(3);
  };

  // camera countdown timer
  useEffect(() => {
    if (cameraCountdown === null) return;
    if (cameraCountdown === 0) {
      actuallyOpenCamera();
      setCameraCountdown(null);
      return;
    }
    const id = setTimeout(() => {
      setCameraCountdown((c) => (c !== null ? c - 1 : c));
    }, 1000);
    return () => clearTimeout(id);
  }, [cameraCountdown]);

  const stopCamera = () => {
    stopLocalCamera();
    if (socket && cameraId) {
      socket.emit("stream:stop", {
        channelId: CHANNEL_ID,
        streamId: cameraId,
      });
    }
  };

  // ========================================
  // CAPTURE
  // ========================================
  const captureFromVideo = (video: HTMLVideoElement | null, name: string) => {
    if (!video || !video.srcObject) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${Date.now()}.png`;
    a.click();
  };

  const captureScreen = () => {
    if (!screenOn) return;
    captureFromVideo(screenVideoRef.current, "screen");
  };

  const captureCamera = () => {
    if (!cameraOn) return;
    captureFromVideo(cameraVideoRef.current, "camera");
  };

  // ========================================
  // RECORDING SCREEN
  // ========================================
  const startScreenRecording = () => {
    if (!screenStreamRef.current || isScreenRecording) return;

    const rec = new MediaRecorder(screenStreamRef.current, {
      mimeType: "video/webm;codecs=vp8",
    });
    screenRecorderRef.current = rec;
    screenChunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) screenChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(screenChunksRef.current, {
        type: "video/webm",
      });
      setScreenRecordUrl(URL.createObjectURL(blob));
    };

    // 1s chunks for stability
    rec.start(1000);
    setIsScreenRecording(true);
  };

  const stopScreenRecording = () => {
    if (screenRecorderRef.current) {
      screenRecorderRef.current.stop();
      screenRecorderRef.current = null;
    }
    setIsScreenRecording(false);
  };

  // ========================================
  // RECORDING CAMERA
  // ========================================
  const startCameraRecording = () => {
    if (!cameraStreamRef.current || isCameraRecording) return;

    const rec = new MediaRecorder(cameraStreamRef.current, {
      mimeType: "video/webm;codecs=vp8",
    });
    cameraRecorderRef.current = rec;
    cameraChunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) cameraChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(cameraChunksRef.current, {
        type: "video/webm",
      });
      setCameraRecordUrl(URL.createObjectURL(blob));
    };

    rec.start(1000);
    setIsCameraRecording(true);
  };

  const stopCameraRecording = () => {
    if (cameraRecorderRef.current) {
      cameraRecorderRef.current.stop();
      cameraRecorderRef.current = null;
    }
    setIsCameraRecording(false);
  };

  // ========================================
  // cleanup on unmount
  // ========================================
  useEffect(() => {
    return () => {
      stopLocalScreen();
      stopLocalCamera();
      stopScreenRecording();
      stopCameraRecording();
    };
  }, [stopLocalScreen, stopLocalCamera]);

  // ========================================
  // helpers for UI
  // ========================================
  const carStatusText =
    connStatus === "connected"
      ? "متصل"
      : connStatus === "connecting"
      ? "جارٍ الاتصال..."
      : "غير متصل";

  const carStatusColor =
    connStatus === "connected"
      ? "bg-green-500"
      : connStatus === "connecting"
      ? "bg-yellow-400"
      : "bg-red-500";

  const vehicleCameraText = vehicleCameraOwner
    ? "المركبة المتصلة: تبث الكاميرا الآن"
    : "لا توجد مركبة متصلة";

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="relative space-y-6">
      <h1 className="mb-4 text-2xl font-bold">لوحة التحكم الرئيسية</h1>

      {/* ====== top cards ====== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* system / server */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">حالة الخادم</h2>
            <span className="text-[10px] text-slate-500">Socket.io</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${carStatusColor}`} />
            <span>{carStatusText}</span>
          </div>
          {lastDisconnect && (
            <p className="text-[10px] text-slate-500 mt-1">
              آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* vehicle status */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">المركبة المتّصلة</h2>
            <span className="text-[10px] text-slate-500">Camera source</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-3 h-3 rounded-full ${
                vehicleCameraOwner ? "bg-emerald-500" : "bg-slate-600"
              }`}
            />
            <span className="text-sm">{vehicleCameraText}</span>
          </div>
          {vehicleCameraOwner ? (
            <p className="text-[10px] text-emerald-400">
              المصدر من المركبة – سيتم تعطيل كاميرا الإدارة.
            </p>
          ) : (
            <p className="text-[10px] text-slate-500">
              لا يوجد مصدر من مركبة، يمكن تشغيل كاميرا الإدارة.
            </p>
          )}
        </div>

        {/* battery */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">حالة الشحن</h2>
            <span className="text-sm text-slate-400">{batteryLevel}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${
                batteryLevel > 60
                  ? "bg-green-500"
                  : batteryLevel > 30
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${batteryLevel}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            قراءة تقديرية – يمكن ربطها بوحدة التحكم لاحقًا.
          </p>
        </div>

        {/* direction */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">الاتجاه الحالي</h2>
            <span className="text-[10px] text-slate-500">تحكم المركبة</span>
          </div>
          <div className="font-medium text-center">{direction || "متوقف"}</div>
        </div>
      </div>

      {/* ====== main layout ====== */}
      <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-3">
        {/* LEFT: screen broadcast */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">بث الشاشة </h2>
              <span className="text-[10px] text-slate-500">
                القناة: {CHANNEL_ID}
              </span>
            </div>

            <div
              className={`relative rounded-lg overflow-hidden bg-slate-950/40 border border-slate-800/60 mx-auto ${
                isMobile
                  ? "w-full max-w-full aspect-[9/16]"
                  : "w-full aspect-video"
              }`}
            >
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="object-contain w-full h-full bg-black"
              />
              {!screenOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <IconScreen />
                  لا توجد مشاركة شاشة حالياً
                  {connStatus !== "connected" && (
                    <p className="text-[10px] text-red-400">
                      الخادم غير متاح، لا يمكن المشاركة
                    </p>
                  )}
                </div>
              )}

              {isScreenLive && (
                <div className="absolute flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full top-3 left-3 bg-red-500/90">
                  <IconRec active />
                  على الهواء
                </div>
              )}

              {isScreenRecording && (
                <div className="absolute flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full top-3 right-3 bg-red-500/90">
                  <IconRec active />
                  تسجيل الشاشة
                </div>
              )}
            </div>

            {/* screen controls */}
            <div className="flex flex-wrap gap-2 mt-3">
              {!screenOn ? (
                <button
                  onClick={startScreen}
                  disabled={connStatus !== "connected"}
                  className="px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-white inline-flex items-center gap-1 disabled:bg-slate-700/40 disabled:text-slate-500"
                >
                  <IconScreen />
                  مشاركة الشاشة
                </button>
              ) : (
                <button
                  onClick={stopScreen}
                  className="px-3 py-1.5 text-xs rounded-md bg-red-500 hover:bg-red-600 text-white"
                >
                  إيقاف المشاركة
                </button>
              )}

              {/* broadcast */}
              {!isScreenLive ? (
                <button
                  onClick={startBroadcast}
                  disabled={!screenOn || connStatus !== "connected"}
                  className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
                    !screenOn || connStatus !== "connected"
                      ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  <IconRec />
                  بدء البث
                </button>
              ) : (
                <button
                  onClick={stopBroadcast}
                  className="px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 bg-orange-500/90 hover:bg-orange-600 text-white"
                >
                  <IconRec active />
                  إيقاف البث
                </button>
              )}

              {/* capture screen */}
              <button
                onClick={captureScreen}
                disabled={!screenOn}
                className={`px-3 py-1.5 text-xs rounded-md ${
                  !screenOn
                    ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white"
                }`}
              >
                التقاط من الشاشة
              </button>

              {/* recording */}
              {!isScreenRecording ? (
                <button
                  onClick={startScreenRecording}
                  disabled={!screenOn}
                  className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
                    !screenOn
                      ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                      : "bg-slate-700 hover:bg-slate-600 text-white"
                  }`}
                >
                  <IconRec />
                  تسجيل الشاشة
                </button>
              ) : (
                <button
                  onClick={stopScreenRecording}
                  className="px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  <IconRec active />
                  إيقاف التسجيل
                </button>
              )}

              {screenRecordUrl && (
                <a
                  href={screenRecordUrl}
                  download="screen-recording.webm"
                  className="text-xs underline text-emerald-400"
                >
                  تنزيل تسجيل الشاشة
                </a>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: camera + car controls */}
        <div className="flex flex-col gap-4 p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <h2 className="text-lg font-semibold">بث الكاميرا</h2>

          {/* bigger camera box */}
          <div
            className={`relative overflow-hidden rounded-lg bg-slate-950/40 border border-slate-800/60 ${
              isMobile ? "h-64" : "h-80"
            }`}
          >
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className="object-cover w-full h-full transition-transform duration-200"
              style={{ transform: `scale(${cameraZoom})` }}
            />
            {/* no admin camera & no vehicle */}
            {!cameraOn && cameraCountdown === null && !vehicleCameraOwner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                <IconCamera />
                لا توجد كاميرا مفعّلة
                <p className="text-[10px] text-slate-600">
                  يمكنك تشغيل الكاميرا من الإدارة
                </p>
              </div>
            )}
            {/* vehicle camera is active */}
            {!cameraOn && vehicleCameraOwner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-emerald-400">
                <IconCamera />
                الكاميرا قيد البث من مركبة متّصلة
              </div>
            )}
            {/* countdown overlay */}
            {cameraCountdown !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70">
                <div className="w-16 h-16 border-4 rounded-full border-emerald-400 border-t-transparent animate-spin" />
                <p className="text-sm text-white">جارٍ تشغيل الكاميرا...</p>
                <p className="text-3xl font-bold text-white">
                  {cameraCountdown}
                </p>
              </div>
            )}
            {/* recording badge */}
            {isCameraRecording && (
              <div className="absolute flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full top-2 left-2 bg-red-500/90">
                <IconRec active />
                تسجيل الكاميرا
              </div>
            )}
          </div>

          {/* camera controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* start/stop camera */}
            <div className="flex gap-2">
              {!cameraOn ? (
                <button
                  onClick={startCamera}
                  disabled={connStatus !== "connected" || !!vehicleCameraOwner}
                  className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 text-white inline-flex items-center gap-1 disabled:bg-slate-700/40 disabled:text-slate-500"
                >
                  <IconCamera />
                  تشغيل الكاميرا
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="px-3 py-1.5 text-xs rounded-md bg-red-500 hover:bg-red-600 text-white inline-flex items-center gap-1"
                >
                  إيقاف الكاميرا
                </button>
              )}
            </div>

            {/* capture (center) */}
            <button
              onClick={captureCamera}
              disabled={!cameraOn}
              className={`px-3 py-1.5 text-xs rounded-md ${
                !cameraOn
                  ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              التقاط صورة
            </button>

            {/* zoom controls */}
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setCameraZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))
                }
                className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
              >
                تصغير
              </button>
              <button
                onClick={() =>
                  setCameraZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))
                }
                className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
              >
                تكبير
              </button>
              <button
                onClick={() => setCameraZoom(1)}
                className="px-2 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
              >
                إعادة الضبط
              </button>
            </div>
          </div>

          {/* camera recording */}
          <div className="flex flex-wrap gap-2">
            {!isCameraRecording ? (
              <button
                onClick={startCameraRecording}
                disabled={!cameraOn}
                className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
                  !cameraOn
                    ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                    : "bg-slate-700 hover:bg-slate-600 text-white"
                }`}
              >
                <IconRec />
                تسجيل الكاميرا
              </button>
            ) : (
              <button
                onClick={stopCameraRecording}
                className="px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white"
              >
                <IconRec active />
                إيقاف التسجيل
              </button>
            )}

            {cameraRecordUrl && (
              <a
                href={cameraRecordUrl}
                download="camera-recording.webm"
                className="text-xs underline text-emerald-400"
              >
                تنزيل تسجيل الكاميرا
              </a>
            )}
          </div>

          {/* car controls */}
          <div className="pt-2 border-t border-slate-800">
            <h3 className="mb-2 text-sm font-semibold">تحكم المركبة</h3>
            <CarControls onDirectionChange={setDirection} />
            <p className="text-[10px] text-slate-500 mt-1">
              الاتجاه الحالي: {direction || "متوقف"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
