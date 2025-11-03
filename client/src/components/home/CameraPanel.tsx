/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState, useEffect } from "react";
import { useMedia } from "../../media/MediaContext";
import { IconCamera, IconRec } from "./StreamIcons";
import CarControls from "../../components/car/CarControls";

interface CameraPanelProps {
  // نفس اللي نستعمله في Home
  connStatus?: "connecting" | "connected" | "disconnected";
  onDirectionChange?: (d: string) => void;
}

const CameraPanel: React.FC<CameraPanelProps> = ({
  connStatus = "disconnected",
  onDirectionChange = () => {},
}) => {
  // من الـ MediaContext (الإصدار المحدث)
  const media = useMedia() as any;
  const socket = media?.socket ?? null;
  const camera = media?.camera ?? null;
  const streams = Array.isArray(media?.streams) ? media.streams : [];
  const devices = media?.devices ?? null;

  // video element for local camera preview
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  // local recording
  const cameraRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraChunksRef = useRef<Blob[]>([]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordUrl, setRecordUrl] = useState<string | null>(null);

  // safe audio devices (لو طلّعتها في الـ context)
  const audioInputs: Array<{ deviceId: string }> =
    devices?.audioInputs && Array.isArray(devices.audioInputs)
      ? devices.audioInputs
      : [];

  // detect other active camera (onAir=true) in same channel
  const myId = socket?.id;
  const otherCamera = streams.find(
    (s: any) =>
      s.kind === "camera" &&
      s.ownerId !== myId &&
      (s.onAir === true || s.onAir === 1),
  );

  // bind context camera to this video
  useEffect(() => {
    if (!camera || !camera.bindVideo) return;
    camera.bindVideo(cameraVideoRef.current);
  }, [camera]);

  // camera start countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      // start actual camera
      camera
        ?.start?.({
          withAudio: true,
          // لو ما يدعم هذي المتغيرات يتجاهلها
          audioDeviceId: audioInputs[0]?.deviceId,
        })
        .catch(() => {
          setCountdown(null);
        });
      setCountdown(null);
      return;
    }
    const id = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : c));
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown, camera, audioInputs]);

  // if someone else went ON AIR → stop our camera and recording
  useEffect(() => {
    if (otherCamera) {
      if (camera?.isOn) {
        camera.stop();
      }
      if (cameraRecorderRef.current) {
        cameraRecorderRef.current.stop();
        cameraRecorderRef.current = null;
        setIsRecording(false);
      }
    }
  }, [otherCamera, camera]);

  const startCamera = () => {
    if (connStatus !== "connected") return;
    if (otherCamera) return; // هناك كاميرا ثانية على الهواء
    if (camera?.isOn) return;
    if (countdown !== null) return;
    setCountdown(3);
  };

  const stopCamera = () => {
    camera?.stop?.();
    // stop recording if any
    if (cameraRecorderRef.current) {
      cameraRecorderRef.current.stop();
      cameraRecorderRef.current = null;
      setIsRecording(false);
    }
  };

  const captureCamera = () => {
    // prefer context capture
    if (camera && typeof camera.capture === "function") {
      camera.capture();
      return;
    }
    // fallback: capture video frame
    const video = cameraVideoRef.current;
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
    a.download = `camera-capture-${Date.now()}.png`;
    a.click();
  };

  const startCameraRecording = () => {
    if (!cameraVideoRef.current) return;
    const stream = cameraVideoRef.current.srcObject as MediaStream | null;
    if (!stream) return;
    if (isRecording) return;

    const rec = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    cameraRecorderRef.current = rec;
    cameraChunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) cameraChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(cameraChunksRef.current, { type: "video/webm" });
      setRecordUrl(URL.createObjectURL(blob));
    };

    rec.start(1000);
    setIsRecording(true);
  };

  const stopCameraRecording = () => {
    if (!cameraRecorderRef.current) return;
    cameraRecorderRef.current.stop();
    cameraRecorderRef.current = null;
    setIsRecording(false);
  };

  const handleDirection = (dir: string) => {
    // send to parent (لوحة التحكم)
    onDirectionChange(dir);
    // send to socket → يروح لنست الجديد اللي يقرأ car:control
    if (socket) {
      socket.emit("car:control", {
        direction: dir || "stop",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-slate-900/50 border-slate-800">
      <h2 className="text-lg font-semibold text-white">بث الكاميرا</h2>

      <div className="relative overflow-hidden border rounded-lg bg-slate-950/40 border-slate-800/60 h-80">
        <video
          ref={cameraVideoRef}
          autoPlay
          playsInline
          muted
          className="object-cover w-full h-full transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        />

        {/* no camera on */}
        {!camera?.isOn && countdown === null && !otherCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
            <IconCamera />
            ما في كاميرا شغّالة
            <p className="text-[10px] text-slate-600">
              اضغط “تشغيل الكاميرا”
            </p>
          </div>
        )}

        {/* another camera is on */}
        {!camera?.isOn && otherCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-emerald-400 bg-slate-950/60">
            <IconCamera />
            توجد كاميرا أخرى على الهواء
          </div>
        )}

        {/* countdown */}
        {countdown !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70">
            <div className="w-16 h-16 border-4 rounded-full border-emerald-400 border-t-transparent animate-spin" />
            <p className="text-sm text-white">جارٍ تشغيل الكاميرا...</p>
            <p className="text-3xl font-bold text-white">{countdown}</p>
          </div>
        )}

        {/* recording badge */}
        {isRecording && (
          <div className="absolute flex items-center gap-1 px-3 py-1 text-xs text-white rounded-full top-2 left-2 bg-red-500/90">
            <IconRec active />
            تسجيل الكاميرا
          </div>
        )}
      </div>

      {/* main actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {!camera?.isOn ? (
            <button
              onClick={startCamera}
              disabled={connStatus !== "connected" || !!otherCamera}
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

        <button
          onClick={captureCamera}
          disabled={!camera?.isOn}
          className={`px-3 py-1.5 text-xs rounded-md ${
            !camera?.isOn
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
              setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))
            }
            className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
          >
            تصغير
          </button>
          <button
            onClick={() =>
              setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))
            }
            className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700"
          >
            تكبير
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600"
          >
            إعادة الضبط
          </button>
        </div>
      </div>

      {/* recording actions */}
      <div className="flex flex-wrap gap-2">
        {!isRecording ? (
          <button
            onClick={startCameraRecording}
            disabled={!camera?.isOn}
            className={`px-3 py-1.5 text-xs rounded-md inline-flex items-center gap-1 ${
              !camera?.isOn
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

        {recordUrl && (
          <a
            href={recordUrl}
            download="camera-recording.webm"
            className="text-xs underline text-emerald-400"
          >
            تنزيل تسجيل الكاميرا
          </a>
        )}
      </div>

      {/* car control */}
      <div className="pt-2 border-t border-slate-800">
        <h3 className="mb-2 text-sm font-semibold text-white">
          تحكم المركبة
        </h3>
        <CarControls onDirectionChange={handleDirection} />
      </div>
    </div>
  );
};

export default CameraPanel;
