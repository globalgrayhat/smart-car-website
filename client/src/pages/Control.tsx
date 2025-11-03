// src/pages/Control.tsx
// Vehicle control room
// - Uses useVehicleCamera() hook (already connection-safe)
// - Shows remote camera banner
// - Lets admin pick another device (VehiclePicker)
// - All socket emits go through MediaContext, so if socket is not connected → UI still works
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useVehicleCamera } from "../hooks/useVehicleCamera";
import VehicleConnectionBar from "../components/vehicle/VehicleConnectionBar";
import VehicleStartPrompt from "../components/vehicle/VehicleStartPrompt";
import VehicleCameraPreview from "../components/vehicle/VehicleCameraPreview";
import CarControls from "../components/car/CarControls";
import { IconRec } from "../components/home/StreamIcons";
import VehiclePicker, {
  type RemoteDevice,
} from "../components/vehicle/VehiclePicker";
import IncomingCameraBar from "../components/admin/IncomingCameraBar";

const Control: React.FC = () => {
  const { user } = useAuth();
  const {
    videoRef,
    connStatus,
    lastDisconnect,
    showPrompt,
    countdown,
    isCameraOn,
    isRecording,
    recordedUrl,
    zoom,
    zoomIn,
    zoomOut,
    zoomReset,
    requestStartCamera,
    stopCamera,
    startRecording,
    stopRecording,
    handleScreenshot,
    sendCarCommand,
    isRemoteCamera,
    remoteLabel,
    remoteStreamId,
    stopRemoteCamera,
    requestRemoteDeviceCamera,
  } = useVehicleCamera();

  // derive user id in safe way
  const u = user as any;
  const currentUserId: number | null =
    (typeof u?.id === "number" ? u.id : undefined) ??
    (typeof u?.userId === "number" ? u.userId : undefined) ??
    (typeof u?.sub === "number" ? u.sub : undefined) ??
    null;

  const [showPicker, setShowPicker] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const handleDirectOpen = (dev: RemoteDevice) => {
    // same-account device → request its camera directly
    requestRemoteDeviceCamera(dev.ownerId);
    setLastMessage(
      `تم فتح كاميرا ${dev.label || "جهاز"} (${dev.ownerId.slice(0, 5)}…)`,
    );
  };

  const handleRequested = (dev: RemoteDevice) => {
    setLastMessage(
      `تم إرسال طلب تفعيل إلى ${dev.label || "جهاز"} (${dev.ownerId.slice(
        0,
        5,
      )}…)`,
    );
  };

  return (
    <div className="relative space-y-6 animate-fadeIn">
      {/* global incoming requests from other devices */}
      <IncomingCameraBar />

      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            غرفة تحكّم المركبة
          </h2>
          <p className="text-sm text-slate-400">
            بث كاميرا + تحكّم بالمركبة + اختيار مركبة ثانية.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPicker(true)}
            className="px-3 py-2 text-xs rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 transition active:scale-[.98]"
          >
            اختيار مركبة متاحة
          </button>

          {!isCameraOn ? (
            <button
              onClick={requestStartCamera}
              disabled={connStatus !== "connected"}
              className="px-4 py-2 text-sm text-white transition rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700/40 disabled:text-slate-500"
            >
              تشغيل الكاميرا
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="px-4 py-2 text-sm text-white transition bg-red-500 rounded-md hover:bg-red-600"
            >
              إيقاف
            </button>
          )}

          {isCameraOn && !isRecording && !isRemoteCamera && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white transition rounded-md bg-slate-700 hover:bg-slate-600"
            >
              <IconRec />
              تسجيل
            </button>
          )}

          {isCameraOn && isRecording && !isRemoteCamera && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white transition bg-orange-500 rounded-md hover:bg-orange-600"
            >
              <IconRec active />
              إيقاف التسجيل
            </button>
          )}
        </div>
      </div>

      {/* connection banner (socket) */}
      <VehicleConnectionBar
        connStatus={connStatus}
        lastDisconnect={lastDisconnect}
      />

      {/* remote is on */}
      {isRemoteCamera && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs border rounded bg-emerald-500/10 border-emerald-500/40 text-emerald-50">
          <span>
            📱 فيه جهاز/مركبة تبث الآن
            {remoteLabel ? ` (${remoteLabel})` : ""}.
          </span>
          {remoteStreamId ? (
            <button
              onClick={() => stopRemoteCamera(remoteStreamId)}
              className="px-2 py-1 text-[10px] rounded bg-emerald-500 text-slate-950 transition active:scale-[.96]"
            >
              تعطيل بث الجهاز
            </button>
          ) : null}
        </div>
      )}

      {/* first-time camera prompt */}
      <VehicleStartPrompt
        visible={showPrompt}
        countdown={countdown}
        onCancel={stopCamera}
      />

      {/* last action message */}
      {lastMessage ? (
        <div className="px-3 py-2 text-xs border rounded bg-slate-800/40 text-slate-100 border-slate-600/40">
          {lastMessage}
        </div>
      ) : null}

      {/* main box */}
      <div className="p-4 space-y-5 border rounded-lg bg-slate-900/50 border-slate-800">
        <h3 className="mb-1 text-sm font-semibold text-white">
          معاينة كاميرا المركبة
        </h3>

        <VehicleCameraPreview
          videoRef={videoRef}
          isCameraOn={isCameraOn}
          isRecording={isRecording}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
        />

        <div className="pt-2 border-t border-slate-800">
          <h4 className="mb-2 text-xs text-slate-400">تحكم المركبة</h4>
          <CarControls
            onDirectionChange={(dir: string) => {
              if (!dir) {
                sendCarCommand("stop");
              } else {
                // actions expected by backend: forward/backward/left/right
                sendCarCommand(dir);
              }
            }}
          />

          <div className="mt-3">
            <button
              onClick={handleScreenshot}
              disabled={!isCameraOn}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                !isCameraOn
                  ? "bg-slate-700/40 text-slate-500 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              لقطة من الكاميرا
            </button>
          </div>
        </div>

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

      {/* remote device picker modal */}
      <VehiclePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        currentUserId={currentUserId}
        onDirectOpen={handleDirectOpen}
        onRequested={handleRequested}
      />
    </div>
  );
};

export default Control;
