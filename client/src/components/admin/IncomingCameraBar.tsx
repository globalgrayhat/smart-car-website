// frontend/src/components/admin/IncomingCameraBar.tsx
import React from "react";
import { useMedia } from "../../media/MediaContext";
import { api } from "../../services/api";

/**
 * Shows incoming camera / join requests coming from other devices/users.
 * - camera attach: { fromSocketId, fromUserId, fromUsername, reason, at }
 * - join request (socket): stored separately in media ctx
 * Falls back to just clearing if backend didn't accept.
 */
const IncomingCameraBar: React.FC = () => {
  const media = useMedia() as any;

  // from mediasoup / signal context
  const cameraRequests = media?.incomingCameraRequests ?? [];
  const joinRequests = media?.incomingJoinRequests ?? [];
  const clearCameraReq = media?.clearCameraRequest;
  const clearJoinReq = media?.clearJoinRequest;
  const socket = media?.socket ?? null;

  const total = cameraRequests.length + joinRequests.length;
  if (!total) return null;

  const handleAcceptCamera = async (
    idx: number,
    socketId?: string | null,
  ) => {
    // 1) try to tell backend to force camera ON for that socket
    if (socketId) {
      try {
        // هذا موجود عندك في Nest -> SignalDevicesController
        await api.post(`/signal/devices/${socketId}/camera/on`);
      } catch {
        // لو فشل REST نحاول إعلامه عبر السوكت مباشرة (لو السيرفر سامع)
        if (socket) {
          socket.emit("camera:attach-accept", { toSocketId: socketId });
        }
      }
    }
    // 2) clear from UI
    clearCameraReq?.(idx);
  };

  const handleRejectCamera = (idx: number, socketId?: string | null) => {
    if (socketId && socket) {
      socket.emit("camera:attach-reject", { toSocketId: socketId });
    }
    clearCameraReq?.(idx);
  };

  const handleApproveJoin = (idx: number) => {
    // حالياً ما في event رسمي للقبول في gateway
    // اللي نقدر نسويه هو إزالة الطلب من الواجهة
    clearJoinReq?.(idx);
  };

  const handleRejectJoin = (idx: number) => {
    clearJoinReq?.(idx);
  };

  return (
    <div className="flex flex-col gap-2 p-3 mb-4 border rounded-md bg-amber-500/10 border-amber-500/40">
      <p className="text-xs font-semibold text-amber-100">
        عندك {total} طلب{total > 1 ? "ات" : ""} واردة الآن.
      </p>

      {/* camera attach requests */}
      {cameraRequests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cameraRequests.map((req: any, idx: number) => (
            <div
              key={`cam-${idx}`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-slate-950/60 text-slate-50"
            >
              <div>
                <p className="text-xs text-white">
                  {req.fromUsername || "مستخدم مجهول"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {req.reason || "طلب تشغيل الكاميرا"}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    handleAcceptCamera(idx, req.fromSocketId ?? null)
                  }
                  className="px-2 py-1 text-[10px] rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  قبول
                </button>
                <button
                  onClick={() =>
                    handleRejectCamera(idx, req.fromSocketId ?? null)
                  }
                  className="px-2 py-1 text-[10px] rounded bg-slate-700 text-slate-100 hover:bg-slate-600"
                >
                  رفض
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* join-broadcast / viewer join requests (socket-based) */}
      {joinRequests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {joinRequests.map((req: any, idx: number) => (
            <div
              key={`join-${idx}`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-slate-950/60 text-slate-50"
            >
              <div>
                <p className="text-xs text-white">
                  {req.fromUsername || "مشاهد"}
                </p>
                <p className="text-[10px] text-slate-400">
                  يبي ينضم للبث {req.message ? `– ${req.message}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleApproveJoin(idx)}
                  className="px-2 py-1 text-[10px] rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  سماح
                </button>
                <button
                  onClick={() => handleRejectJoin(idx)}
                  className="px-2 py-1 text-[10px] rounded bg-slate-700 text-slate-100 hover:bg-slate-600"
                >
                  رفض
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncomingCameraBar;
