// src/components/JoinRequestBar.tsx
import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { isViewer } from "../auth/roles";

type JoinStatus = "idle" | "pending" | "approved" | "rejected" | "error";

// هذا هو مالك الحساب اللي يستقبل الطلب
const ACCOUNT_OWNER_ID = 1;

const JoinRequestBar: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<JoinStatus>("idle");
  const [loading, setLoading] = useState(false);

  if (!user || !isViewer(user.role)) return null;

  const sendRequest = async (mode: "VIEW" | "PUBLISH") => {
    setLoading(true);
    try {
      const data = await api.post("/join-requests", {
        toUserId: ACCOUNT_OWNER_ID,
        message:
          mode === "PUBLISH"
            ? "طلب انضمام كمذيع / أريد مشاركة كاميرتي"
            : "طلب مشاهدة مصدر البث الحالي",
      });
      setStatus(
        data.status === "APPROVED"
          ? "approved"
          : data.status === "REJECTED"
          ? "rejected"
          : "pending",
      );
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.get(
          `/join-requests/last/${ACCOUNT_OWNER_ID}`,
        );
        if (!mounted) return;
        setStatus(
          data?.status === "APPROVED"
            ? "approved"
            : data?.status === "REJECTED"
            ? "rejected"
            : data?.status === "PENDING"
            ? "pending"
            : "idle",
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // لو رفض → نعطيه زر يخفي التنبيه
  if (status === "rejected") {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 mb-4 text-xs text-red-100 border rounded-md border-red-500/40 bg-red-500/5">
        <p>تم رفض طلبك. تقدر تعيد الإرسال لاحقاً.</p>
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
    <div className="flex items-center justify-between gap-3 px-4 py-2 mb-4 text-xs border rounded-md border-amber-500/40 bg-amber-500/10 text-amber-50">
      <div>
        {status === "idle" && (
          <p>
            أنت مسجّل بصلاحية مشاهدة فقط. تقدر تطلب إذن للمشاركة أو الظهور على
            البث.
          </p>
        )}
        {status === "pending" && <p>تم استلام طلبك، بانتظار موافقة المسؤول.</p>}
        {status === "approved" && (
          <p className="text-emerald-200">
            تمّت الموافقة. سجل خروج وادخل مرة ثانية علشان تتحدث الصلاحيات.
          </p>
        )}
        {status === "error" && (
          <p className="text-red-200">تعذّر إرسال الطلب، جرّب مرة ثانية.</p>
        )}
      </div>
      <div className="flex gap-2">
        {(status === "idle" || status === "error") && (
          <>
            <button
              onClick={() => void sendRequest("VIEW")}
              disabled={loading}
              className="rounded bg-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
            >
              طلب مشاهدة
            </button>
            <button
              onClick={() => void sendRequest("PUBLISH")}
              disabled={loading}
              className="rounded bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-amber-50 border border-amber-400/40 hover:bg-slate-900 disabled:opacity-60"
            >
              طلب بث الكاميرا
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinRequestBar;
