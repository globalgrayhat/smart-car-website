/* eslint-disable @typescript-eslint/no-explicit-any */
// Control page:
// - ADMIN / BROADCAST_MANAGER: يقدر يشغّل كاميرا HOST_CAMERA و يختار أجهزة.
// - VIEWER: يشاهد بث المضيف + يتحكم إذا عنده CONTROL APPROVED.

import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { canPublish, isViewer } from "../auth/roles";
import { useVehicleCamera } from "../hooks/useVehicleCamera";
import { useMedia } from "../media/MediaContext";
import VehicleConnectionBar from "../components/vehicle/VehicleConnectionBar";
import VehicleStartPrompt from "../components/vehicle/VehicleStartPrompt";
import VehicleCameraPreview from "../components/vehicle/VehicleCameraPreview";
import CarControls from "../components/car/CarControls";
import { IconRec } from "../components/home/StreamIcons";
import VehiclePicker, {
  type RemoteDevice,
} from "../components/vehicle/VehiclePicker";
import IncomingCameraBar from "../components/admin/IncomingCameraBar";
import { api } from "../services/api";

type PublicBroadcast = {
  id: number;
  title?: string | null;
  kind?: string | null;
  onAir?: boolean;
  externalId?: string | null;
  ownerUserId?: number | null;
};

const OWNER_FALLBACK = Number(import.meta.env.VITE_OWNER_USER_ID || "1");

const Control: React.FC = () => {
  const { user } = useAuth();
  const media = useMedia() as any;

  const isPublisher = canPublish(user?.role);
  const viewerOnly = isViewer(user?.role);

  const u = user as any;
  const currentUserId: number | null =
    (typeof u?.id === "number" && u.id) ||
    (typeof u?.userId === "number" && u.userId) ||
    null;

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
    showRemotePicker,
    setShowRemotePicker,
  } = useVehicleCamera();

  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [canControlByJoin, setCanControlByJoin] = useState(false);
  const [autoAttachDone, setAutoAttachDone] = useState(false);

  // -------- VIEWER: auto-attach to HOST_CAMERA from /broadcast/public --------
  useEffect(() => {
    const run = async () => {
      if (!viewerOnly || isPublisher) return;

      const webRtcConnected =
        connStatus === "connected" ||
        media?.connStatus === "connected" ||
        media?.status === "connected";

      if (!webRtcConnected) return;
      if (autoAttachDone) return;

      try {
        const res = await api.get("/broadcast/public");
        const list: PublicBroadcast[] = Array.isArray(res) ? res : [];

        const hostCam =
          list.find(
            (b) =>
              b &&
              b.onAir &&
              (b.kind === "HOST_CAMERA" || b.kind === "CAR_CAMERA") &&
              b.externalId,
          ) || null;

        if (!hostCam || !hostCam.externalId) {
          return;
        }

        await requestRemoteDeviceCamera(String(hostCam.externalId));
        setAutoAttachDone(true);

        const ownerId =
          (hostCam.ownerUserId as number | undefined) || OWNER_FALLBACK;

        if (currentUserId && ownerId && ownerId !== currentUserId) {
          const statusRes = (await api.get(
            `/join-requests/last/${ownerId}`,
          )) as
            | { status: "NONE" }
            | {
                status: "APPROVED" | "PENDING" | "REJECTED";
                intent: string;
              }
            | null;

          if (
            statusRes &&
            statusRes.status === "APPROVED" &&
            statusRes.intent === "CONTROL"
          ) {
            setCanControlByJoin(true);
          } else {
            setCanControlByJoin(false);
          }
        }
      } catch {
        // نترك الـ Preview يوضح أنه لا يوجد بث
      }
    };

    void run();
  }, [
    viewerOnly,
    isPublisher,
    connStatus,
    media?.connStatus,
    media?.status,
    autoAttachDone,
    requestRemoteDeviceCamera,
    currentUserId,
  ]);

  // -------- Admin: direct open from picker --------
  const handleDirectOpen = (dev: RemoteDevice) => {
    requestRemoteDeviceCamera(dev.ownerId);
    setLastMessage(
      `تم طلب تشغيل كاميرا الجهاز ${dev.label || ""} (${String(
        dev.ownerId,
      ).slice(0, 5)}…)`,
    );
  };

  const handleRequested = (dev: RemoteDevice) => {
    setLastMessage(
      `تم إرسال طلب تفعيل إلى ${dev.label || ""} (${String(
        dev.ownerId,
      ).slice(0, 5)}…)`,
    );
  };

  const handleDirection = (dir: string) => {
    sendCarCommand(dir || "stop");
  };

  // ================== VIEWER UI ==================
  if (viewerOnly && !isPublisher) {
    return (
      <div className="relative space-y-6 animate-fadeIn">
        <IncomingCameraBar />

        <h2 className="text-xl font-semibold text-white">
          غرفة تحكم المركبة (مشاهد)
        </h2>
        <p className="text-sm text-slate-400">
          يتم توصيلك تلقائياً بأول بث HOST_CAMERA / CAR_CAMERA نشط، إذا كان
          المضيف على الهواء.
        </p>

        <VehicleConnectionBar
          connStatus={media?.connStatus ?? connStatus}
          lastDisconnect={lastDisconnect}
        />

        <VehicleCameraPreview
          videoRef={videoRef}
          isCameraOn={isRemoteCamera}
          isRecording={false}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          isRemote={isRemoteCamera}
          remoteLabel={remoteLabel || "بث المضيف"}
        />

        {canControlByJoin ? (
          <div className="pt-4 mt-2 border-t border-slate-800">
            <h3 className="mb-2 text-sm font-semibold text-white">
              تحكم في حركة المركبة (مصرّح)
            </h3>
            <CarControls onDirectionChange={handleDirection} />
          </div>
        ) : (
          <div className="pt-4 mt-2 border-t border-slate-800">
            <p className="text-[11px] text-slate-500">
              لطلب التحكم، أرسل طلب CONTROL من واجهة البث، وعند الموافقة
              ستظهر أزرار التحكم هنا.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ================== ADMIN / PUBLISHER UI ==================
  return (
    <div className="relative space-y-6 animate-fadeIn">
      <IncomingCameraBar />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            غرفة تحكم المركبة
          </h2>
          <p className="text-sm text-slate-400">
            تشغيل بث كاميرا التحكم، اختيار مركبة/جهاز، والتحكم في الحركة. البث
            يظهر للمشاهدين في الواجهات الأخرى.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowRemotePicker(true)}
            className="px-3 py-2 text-xs transition rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700"
          >
            اختيار مركبة / جهاز
          </button>

          {!isCameraOn ? (
            <button
              onClick={requestStartCamera}
              disabled={connStatus !== "connected" || isRemoteCamera}
              className="px-4 py-2 text-sm text-white transition rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700/40 disabled:text-slate-500"
            >
              تشغيل كاميرا التحكم
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="px-4 py-2 text-sm text-white transition bg-red-500 rounded-md hover:bg-red-600"
            >
              إيقاف الكاميرا
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

      <VehicleConnectionBar
        connStatus={connStatus}
        lastDisconnect={lastDisconnect}
      />

      {isRemoteCamera && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs border rounded bg-emerald-500/10 border-emerald-500/40 text-emerald-50">
          <span>
            هناك بث كاميرا نشط من جهاز/مركبة أخرى
            {remoteLabel ? ` (${remoteLabel})` : ""}.
          </span>
          {remoteStreamId && (
            <button
              onClick={() => stopRemoteCamera(remoteStreamId)}
              className="px-2 py-1 text-[10px] rounded bg-emerald-500 text-slate-950"
            >
              إيقاف بث الجهاز
            </button>
          )}
        </div>
      )}

      <VehicleStartPrompt
        visible={showPrompt}
        countdown={countdown}
        onCancel={stopCamera}
      />

      {lastMessage && (
        <div className="px-3 py-2 text-[10px] rounded-md bg-slate-900/70 border border-slate-700 text-slate-300">
          {lastMessage}
        </div>
      )}

      <VehicleCameraPreview
        videoRef={videoRef}
        isCameraOn={isCameraOn || isRemoteCamera}
        isRecording={isRecording}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        isRemote={isRemoteCamera}
        remoteLabel={remoteLabel}
      />

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <button
          onClick={handleScreenshot}
          disabled={!isCameraOn && !isRemoteCamera}
          className={`px-3 py-1.5 rounded ${
            isCameraOn || isRemoteCamera
              ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          التقاط صورة من الكاميرا
        </button>
        {recordedUrl && (
          <a
            href={recordedUrl}
            download="vehicle-camera-recording.webm"
            className="underline text-emerald-400"
          >
            تنزيل تسجيل الكاميرا
          </a>
        )}
      </div>

      <div className="pt-4 mt-2 border-t border-slate-800">
        <h3 className="mb-2 text-sm font-semibold text-white">
          تحكم في حركة المركبة
        </h3>
        <p className="mb-2 text-[10px] text-slate-500">
          الأزرار ترسل أوامر لحظية إلى خادم الإشارة.
        </p>
        <CarControls onDirectionChange={handleDirection} />
      </div>

      <VehiclePicker
        visible={showRemotePicker}
        onClose={() => setShowRemotePicker(false)}
        currentUserId={currentUserId}
        onDirectOpen={handleDirectOpen}
        onRequested={handleRequested}
      />
    </div>
  );
};

export default Control;
