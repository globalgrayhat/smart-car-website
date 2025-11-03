// frontend/src/components/admin/JoinRequestsPanel.tsx
import React, { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../auth/AuthContext";
import { useMedia } from "../../media/MediaContext";

/**
 * NOTE:
 * - Admin / broadcast manager sees socket live requests + DB requests.
 * - UI text Arabic, comments English.
 */
type JoinRequest = {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

const JoinRequestsPanel: React.FC = () => {
  const { user } = useAuth();
  const media = useMedia() as any;
  const incomingJoinRequests = media?.incomingJoinRequests ?? [];
  const clearJoinRequest = media?.clearJoinRequest;
  const [items, setItems] = useState<JoinRequest[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const isAdmin =
    user?.role === "ADMIN" || user?.role === "BROADCAST_MANAGER";

  const load = async () => {
    try {
      const data = await api.get("/join-requests/my");
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const handleApprove = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/join-requests/${id}/approve`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/join-requests/${id}/reject`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-slate-900/60 border-slate-700">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white">
          طلبات الانضمام للبث
        </h3>
        <button
          onClick={() => void load()}
          className="px-2 py-1 text-[10px] rounded bg-slate-800 text-slate-100 hover:bg-slate-700"
        >
          تحديث
        </button>
      </div>

      {/* socket-live requests (from viewers) */}
      {incomingJoinRequests.length > 0 && (
        <div className="mb-3 space-y-2">
          {incomingJoinRequests.map((req: any, idx: number) => (
            <div
              key={`live-${idx}`}
              className="flex items-center justify-between gap-3 px-3 py-2 text-xs border rounded bg-emerald-500/10 border-emerald-500/30 text-emerald-50"
            >
              <div>
                <p>
                  طلب مباشر من المستخدم{" "}
                  {req.fromUsername || `#${req.fromUserId}`}
                </p>
                {req.message ? (
                  <p className="text-[10px] text-emerald-100/60">
                    {req.message}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1">
                {/* في البث الحي ما عندنا API لقبول الطلب فوراً → نخفيه من الواجهة */}
                <button
                  onClick={() => clearJoinRequest?.(idx)}
                  className="px-2 py-1 text-[10px] rounded bg-slate-900/80 text-white"
                >
                  إخفاء
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* db requests */}
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">لا توجد طلبات حالياً.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 p-3 text-xs border rounded bg-slate-950/30 border-slate-800"
            >
              <div>
                <p className="text-slate-100">
                  طلب من المستخدم #{it.fromUserId}
                </p>
                {it.message ? (
                  <p className="text-[10px] text-slate-400">{it.message}</p>
                ) : null}
                <p className="text-[9px] text-slate-500">
                  الحالة:{" "}
                  {it.status === "PENDING"
                    ? "قيد المراجعة"
                    : it.status === "APPROVED"
                    ? "تمت الموافقة"
                    : "مرفوض"}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => void handleApprove(it.id)}
                  disabled={busyId === it.id}
                  className="px-2 py-1 text-[10px] rounded bg-emerald-500 text-slate-950 disabled:opacity-50"
                >
                  موافقة
                </button>
                <button
                  onClick={() => void handleReject(it.id)}
                  disabled={busyId === it.id}
                  className="px-2 py-1 text-[10px] rounded bg-red-500 text-white disabled:opacity-50"
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

export default JoinRequestsPanel;
