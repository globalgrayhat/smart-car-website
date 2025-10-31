/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";
// ======================================
// CONFIG
// ======================================
// signaling server url
const SIGNAL_SERVER = "http://localhost:5000";
// channel / room name
const CHANNEL_ID = "global";

// simple icon (screen)
const IconScreen: React.FC = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    stroke="currentColor"
    fill="none"
    className="opacity-90"
  >
    <rect x="3" y="4" width="18" height="12" rx="1.5" strokeWidth="1.3" />
    <path d="M9 20h6" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M12 16v4" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const IconRec: React.FC<{ active?: boolean }> = ({ active = false }) => (
  <span
    className={`inline-flex h-2.5 w-2.5 rounded-full ${
      active ? "bg-red-400 animate-pulse" : "bg-slate-500"
    }`}
  />
);

const Dashboard: React.FC = () => {
  // ======================================
  // SOCKET STATE
  // ======================================
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [lastDisconnect, setLastDisconnect] = useState<number | null>(null);

  // ======================================
  // SCREEN STATE
  // ======================================
  const [isSharing, setIsSharing] = useState(false); // local screen is on
  const [isBroadcasting, setIsBroadcasting] = useState(false); // on air
  const [error, setError] = useState<string | null>(null);
  const [screenId, setScreenId] = useState<string | null>(null); // id from server
  const [isMobile, setIsMobile] = useState(false);

  // ======================================
  // RECORDING
  // ======================================
  const [isRecording, setIsRecording] = useState(false);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<Blob[]>([]);

  // ======================================
  // MEDIA REFS
  // ======================================
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // ======================================
  // HELPER: stop local screen (DRY)
  //  - stop media tracks
  //  - clear video element
  //  - reset ui
  // ======================================
  const stopLocalScreen = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setIsSharing(false);
    setIsBroadcasting(false);
  }, []);

  // ======================================
  // detect mobile
  // ======================================
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

  // ======================================
  // SOCKET
  // ======================================
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
      // join channel as admin / control
      s.emit("channel:join", { channelId: CHANNEL_ID, role: "control" });
    });

    // on disconnect
    const handleDisconnect = () => {
      setConnStatus("disconnected");
      setLastDisconnect(Date.now());
      notifySignalDisconnected();
      // if server is down -> stop local media and recording
      stopLocalScreen();
      stopScreenRecording();
      setScreenId(null);
    };

    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleDisconnect);

    // server sends current streams
    s.on("channel:streams", (streams: any[]) => {
      // if we have our stream there
      const mine = streams.find(
        (st) => st.ownerId === s.id && st.kind === "screen"
      );
      if (mine) {
        setScreenId(mine.streamId);
        if (mine.isLive) setIsBroadcasting(true);
      } else {
        setScreenId(null);
        setIsBroadcasting(false);
      }
    });

    // server: someone started a stream
    s.on("stream:started", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id && p.kind === "screen") {
        setScreenId(p.streamId);
      }
    });

    // server: someone stopped a stream
    s.on("stream:stopped", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id && p.kind === "screen") {
        // our screen was stopped by server -> stop locally
        stopLocalScreen();
        stopScreenRecording();
        setScreenId(null);
      }
    });

    // server: broadcast started
    s.on("stream:broadcast:started", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id) {
        setIsBroadcasting(true);
      }
    });

    // server: broadcast stopped
    s.on("stream:broadcast:stopped", (p: any) => {
      if (p.channelId !== CHANNEL_ID) return;
      if (p.ownerId === s.id) {
        setIsBroadcasting(false);
      }
    });

    return () => {
      s.disconnect();
    };
  }, [stopLocalScreen]);

  // ======================================
  // announce broadcast qualities
  // (optional for viewers to pick)
  //  this is similar to admin screen in previous component
  // ======================================
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

  // ======================================
  // start local screen
  // ======================================
  const startLocalScreen = async () => {
    if (connStatus !== "connected") {
      setError("الخادم غير متصل، لا يمكن مشاركة الشاشة.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: isMobile
          ? {
              width: { ideal: 430 },
              height: { ideal: 900 },
              frameRate: { ideal: 20, max: 30 },
            }
          : {
              width: { ideal: 1600 },
              height: { ideal: 900 },
              frameRate: { ideal: 30, max: 60 },
            },
        audio: false,
      });

      const video = screenVideoRef.current;

      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      screenStreamRef.current = stream;
      setIsSharing(true);
      setError(null);

      // notify server we started screen
      socket?.emit("stream:start", {
        channelId: CHANNEL_ID,
        kind: "screen",
      });
      // announce available qualities
      announceQualities();

      // if user stops from browser ui
      const track = stream.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        stopScreen();
      });
    } catch (err) {
      console.error(err);
      setError("تم إلغاء مشاركة الشاشة أو منعها من المتصفح.");
      setIsSharing(false);
    }
  };

  // ======================================
  // stop screen
  // ======================================
  const stopScreen = () => {
    // stop local
    stopLocalScreen();

    // tell server
    if (socket && screenId) {
      socket.emit("stream:stop", {
        channelId: CHANNEL_ID,
        streamId: screenId,
      });
    }
  };

  // ======================================
  // start broadcast (on air)
  // ======================================
  const startBroadcast = () => {
    if (!socket || !screenId || !isSharing) return;
    socket.emit("stream:broadcast:start", {
      channelId: CHANNEL_ID,
      streamId: screenId,
    });
    setIsBroadcasting(true);
  };

  // ======================================
  // stop broadcast (on air)
  // ======================================
  const stopBroadcast = () => {
    if (!socket || !screenId) return;
    socket.emit("stream:broadcast:stop", {
      channelId: CHANNEL_ID,
      streamId: screenId,
    });
    setIsBroadcasting(false);
  };

  // ======================================
  // capture frame
  // ======================================
  const captureScreen = () => {
    const video = screenVideoRef.current;
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
    a.download = `screen-capture-${Date.now()}.png`;
    a.click();
  };

  // ======================================
  // RECORDING
  // ======================================
  const startScreenRecording = () => {
    if (!screenStreamRef.current || isRecording) return;

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
      const url = URL.createObjectURL(blob);
      setRecordUrl(url);
    };

    // 1000ms chunks for more stable recording
    rec.start(1000);
    setIsRecording(true);
  };

  const stopScreenRecording = () => {
    if (screenRecorderRef.current) {
      screenRecorderRef.current.stop();
      screenRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  // ======================================
  // cleanup
  // ======================================
  useEffect(() => {
    return () => {
      stopLocalScreen();
      stopScreenRecording();
    };
  }, [stopLocalScreen]);

  // ======================================
  // ui helpers
  // ======================================
  const serverStatusLabel =
    connStatus === "connected"
      ? "متصل بالخادم"
      : connStatus === "connecting"
      ? "جارٍ الاتصال بالخادم..."
      : "غير متصل بالخادم";

  const serverStatusColor =
    connStatus === "connected"
      ? "bg-emerald-500"
      : connStatus === "connecting"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* MAIN SCREEN AREA */}
      <div className="space-y-6 xl:col-span-2">
        {/* screen box */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                شاشة المشاركة
              </h2>
              <p className="text-xs text-slate-400">
                هنا تظهر الشاشة التي تتم مشاركتها مع المشاهدين.
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                المشاركة لا تعني البث، يمكنك تجهيز الشاشة ثم الضغط على "بدء
                البث".
              </p>
            </div>

            {/* share / stop */}
            {!isSharing ? (
              <button
                onClick={startLocalScreen}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs disabled:bg-slate-700/40 disabled:text-slate-500"
                disabled={connStatus !== "connected"}
              >
                مشاركة الشاشة
              </button>
            ) : (
              <button
                onClick={stopScreen}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs"
              >
                إيقاف المشاركة
              </button>
            )}
          </div>

          <div
            className={`relative rounded-md border border-slate-700 overflow-hidden bg-slate-950/40 ${
              isMobile ? "aspect-[9/16]" : "aspect-video"
            } flex items-center justify-center`}
          >
            <video
              ref={screenVideoRef}
              id="main-screen-preview"
              autoPlay
              playsInline
              className="object-contain w-full h-full bg-black/40"
            />
            {!isSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800/60 text-slate-200">
                  <IconScreen />
                </div>
                <p className="text-sm">لا توجد شاشة مشتركة حالياً</p>
                {connStatus !== "connected" ? (
                  <p className="text-xs text-red-400">
                    الخادم غير متصل – شغّل الخادم أولاً
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    اضغط "مشاركة الشاشة" لبدء المشاركة
                  </p>
                )}
              </div>
            )}

            {isBroadcasting && (
              <div className="absolute flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full top-3 left-3 bg-red-500/90">
                <IconRec active />
                على الهواء
              </div>
            )}

            {isRecording && (
              <div className="absolute flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full top-3 right-3 bg-red-500/90">
                <IconRec active />
                تسجيل
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          {/* broadcast + capture + record controls */}
          <div className="flex flex-wrap gap-2 mt-4">
            {/* broadcast */}
            {!isBroadcasting ? (
              <button
                onClick={startBroadcast}
                disabled={!isSharing || connStatus !== "connected"}
                className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
                  !isSharing || connStatus !== "connected"
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

            {/* capture */}
            <button
              onClick={captureScreen}
              disabled={!isSharing}
              className={`px-3 py-1.5 text-xs rounded-md ${
                !isSharing
                  ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              التقاط صورة
            </button>

            {/* recording */}
            {!isRecording ? (
              <button
                onClick={startScreenRecording}
                disabled={!isSharing}
                className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
                  !isSharing
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

            {recordUrl && (
              <a
                href={recordUrl}
                download="screen-recording.webm"
                className="text-xs underline text-emerald-400"
              >
                تنزيل تسجيل الشاشة
              </a>
            )}
          </div>
        </div>

        {/* secondary section */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-white">ملاحظات</h2>
          <p className="text-sm text-slate-300">
            يمكن وضع بيانات السيارة، أو مؤشرات الأداء، أو لوحات التحكم هنا. هذا
            الصندوق تمهيدي لإضافات مستقبلية.
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: STATUS / META / SHORTCUTS */}
      <div className="space-y-4">
        {/* connection status */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-white">
            حالة الاتصال
          </h3>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${serverStatusColor}`} />
            <span className="text-sm text-white">{serverStatusLabel}</span>
          </div>
          {lastDisconnect && (
            <p className="text-[10px] text-slate-500 mt-2">
              آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
            </p>
          )}
          <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
            في حال عدم توفر خادم الإشارة لن تتمكن من مشاركة الشاشة أو البث.
          </p>
        </div>

        {/* share controls (quick) */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-white">
            أدوات المشاركة
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            يمكنك بدء أو إيقاف مشاركة الشاشة من هنا. البث لا يبدأ إلا عند الضغط
            على "بدء البث".
          </p>
          {!isSharing ? (
            <button
              onClick={startLocalScreen}
              disabled={connStatus !== "connected"}
              className="w-full py-2 text-sm text-white rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700/40 disabled:text-slate-500"
            >
              بدء مشاركة الشاشة
            </button>
          ) : (
            <button
              onClick={stopScreen}
              className="w-full py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600"
            >
              إيقاف مشاركة الشاشة
            </button>
          )}
          <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">
            المتصفح سيطلب منك اختيار شاشة أو نافذة. عند إغلاق النافذة أو إيقاف
            المشاركة من المتصفح سيتم الإيقاف هنا تلقائياً.
          </p>
        </div>

        {/* stream info */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-white">
            معلومات البث
          </h3>
          <ul className="space-y-1 text-xs text-slate-300">
            <li>
              الحالة:{" "}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                  isSharing
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-slate-700/40 text-slate-200"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                {isSharing ? "جاري المشاركة" : "متوقف"}
              </span>
            </li>
            <li>
              البث المباشر:{" "}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${
                  isBroadcasting
                    ? "bg-red-500/10 text-red-300"
                    : "bg-slate-700/40 text-slate-200"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                {isBroadcasting ? "على الهواء" : "غير مباشر"}
              </span>
            </li>
            <li>المصدر: هذا الجهاز</li>
            <li>الوضع: شاشة فقط (بدون كاميرا)</li>
            <li>الجودة: تلقائي 720p</li>
            {screenId && (
              <li className="text-[10px] text-slate-500 mt-1">
                معرف البث: {screenId}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
