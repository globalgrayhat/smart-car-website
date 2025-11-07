// client/src/components/JoinRequestBar.tsx
// Simple viewer bar to request VIEW permission from main owner.

import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { isViewer } from "../auth/roles";

type JoinStatus = "idle" | "pending" | "approved" | "rejected" | "error";

// Default owner user id (broadcaster account).
const ACCOUNT_OWNER_ID = Number(
  import.meta.env.VITE_OWNER_USER_ID || "1",
);

const JoinRequestBar: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [loading, setLoading] = useState(false);

  // استنتاج الـ userId من الـ user object
  const currentUserId: number | null =
    (user && typeof (user as any).id === "number" && (user as any).id) ||
    (user && typeof (user as any).userId === "number" && (user as any).userId) ||
    null;

  const isOwner =
    currentUserId != null &&
    ACCOUNT_OWNER_ID != null &&
    Number(currentUserId) === Number(ACCOUNT_OWNER_ID);

  // نظهر الشريط فقط:
  // - مستخدم مسجل
  // - دوره Viewer
  // - ليس هو صاحب البث نفسه (حتى لا يرسل لنفسه)
  if (!user || !isViewer(user.role) || isOwner) return null;

  const sendViewRequest = async () => {
    setLoading(true);
    try {
      const res = await api.post<{
        id: number;
        status: "PENDING" | "APPROVED" | "REJECTED";
      }>("/join-requests", {
        toUserId: ACCOUNT_OWNER_ID,
        intent: "VIEW",
        message: "طلب مشاهدة البث.",
      });

      setStatus(
        res.status === "APPROVED"
          ? "approved"
          : res.status === "REJECTED"
          ? "rejected"
          : "pending",
      );
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  // Load last status on mount.
  useEffect(() => {
    if (!currentUserId || isOwner) return;

    (async () => {
      try {
        const res = await api.get<{
          status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
        }>(`/join-requests/last/${ACCOUNT_OWNER_ID}`);

        setStatus(
          res.status === "APPROVED"
            ? "approved"
            : res.status === "REJECTED"
            ? "rejected"
            : res.status === "PENDING"
            ? "pending"
            : "idle",
        );
      } catch {
        // ignore
      }
    })();
  }, [currentUserId, isOwner]);

  if (status === "rejected") {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 mb-4 text-xs text-red-100 border rounded-md border-red-500/40 bg-red-500/5">
        <p>تم رفض طلب المشاهدة. يمكنك المحاولة لاحقاً.</p>
        <button
          onClick={() => setStatus("idle")}
          className="text-[10px] underline"
        >
          إخفاء
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 mb-4 text-xs border rounded-md border-emerald-500/30 bg-emerald-500/5 text-emerald-50">
      <div>
        {status === "idle" && (
          <p>تحتاج لموافقة صاحب البث لعرض القناة.</p>
        )}
        {status === "pending" && (
          <p>طلبك قيد المراجعة لدى صاحب البث.</p>
        )}
        {status === "approved" && (
          <p className="text-emerald-300">
            تمت الموافقة — أعد تحميل صفحة البث لفتح المشاهدة.
          </p>
        )}
        {status === "error" && (
          <p className="text-red-200">
            تعذّر إرسال الطلب، حاول مجدداً.
          </p>
        )}
      </div>
      {(status === "idle" || status === "error") && (
        <button
          onClick={() => void sendViewRequest()}
          disabled={loading}
          className="rounded bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          طلب مشاهدة
        </button>
      )}
    </div>
  );
};

export default JoinRequestBar;
