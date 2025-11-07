/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * IncomingCameraBar
 *
 * Displays incoming camera-attach and join requests for the admin/broadcast owner.
 * - Camera requests: incomingCameraRequests from MediaContext.
 * - Join requests: incomingJoinRequests from MediaContext.
 * - Provides accept/reject actions and falls back gracefully if backend fails.
 */

import React from "react";
import { useMedia } from "../../media/MediaContext";
import { api } from "../../services/api";

const IncomingCameraBar: React.FC = () => {
  const media = useMedia() as any;

  const cameraRequests = media?.incomingCameraRequests ?? [];
  const joinRequests = media?.incomingJoinRequests ?? [];
  const clearCameraReq = media?.clearCameraRequest;
  const clearJoinReq = media?.clearJoinRequest;
  const socket = media?.socket ?? null;

  const total = cameraRequests.length + joinRequests.length;
  if (!total) return null;

  const handleAcceptCamera = async (idx: number, socketId?: string | null) => {
    if (socketId) {
      try {
        await api.post(`/signal/devices/${socketId}/camera/on`);
      } catch {
        if (socket) {
          socket.emit("camera:attach-accept", { toSocketId: socketId });
        }
      }
    }
    clearCameraReq?.(idx);
  };

  const handleRejectCamera = (idx: number, socketId?: string | null) => {
    if (socketId && socket) {
      socket.emit("camera:attach-reject", { toSocketId: socketId });
    }
    clearCameraReq?.(idx);
  };

  const handleApproveJoin = (idx: number) => {
    // Currently no direct gateway event; we simply clear from UI.
    clearJoinReq?.(idx);
  };

  const handleRejectJoin = (idx: number) => {
    clearJoinReq?.(idx);
  };

  return (
    <div className="flex flex-col max-w-5xl gap-2 p-3 mx-auto mb-4 border rounded-lg bg-amber-500/5 border-amber-500/40">
      <p className="text-xs font-semibold text-amber-100">
        لديك {total} طلب وارد قيد المعالجة.
      </p>

      {/* Camera attach requests */}
      {cameraRequests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cameraRequests.map((req: any, idx: number) => (
            <div
              key={`cam-${idx}`}
              className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-slate-950/80 text-slate-50 border border-slate-800/70"
            >
              <div className="min-w-[140px]">
                <p className="text-xs text-white">
                  {req.fromUsername || "مستخدم غير معروف"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {req.reason || "طلب تفعيل الكاميرا."}
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

      {/* Join (viewer/control) requests from socket (ephemeral) */}
      {joinRequests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {joinRequests.map((req: any, idx: number) => (
            <div
              key={`join-${idx}`}
              className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-slate-950/80 text-slate-50 border border-slate-800/70"
            >
              <div className="min-w-[150px]">
                <p className="text-xs text-white">
                  {req.fromUsername || `مستخدم #${req.fromUserId || "غير معروف"}`}
                </p>
                <p className="text-[10px] text-slate-400">
                  طلب الانضمام إلى البث
                  {req.message ? ` – ${req.message}` : "."}
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
