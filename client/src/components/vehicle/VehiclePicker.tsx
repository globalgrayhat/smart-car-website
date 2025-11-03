// src/components/vehicle/VehiclePicker.tsx
import React, { useEffect, useState } from "react";
import { api } from "../../services/api";

// NOTE: type-only import مو ضروري هنا لأننا داخل نفس الملف
export type RemoteDevice = {
  ownerId: string;               // socket.id للجهاز
  userId: number | null;         // رقم مستخدم الجهاز (يرسله الباكند)
  label?: string;
  streamId?: string | null;
  onAir?: boolean;
  isMine?: boolean;              // لو الباكند علّمه إنه لنفس الحساب
};

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUserId: number | null;
  // لو نفس الحساب → افتح مباشرة
  onDirectOpen?: (dev: RemoteDevice) => void;
  // لو حساب مختلف → نقول للصفحة "تم الإرسال"
  onRequested?: (dev: RemoteDevice) => void;
};

const VehiclePicker: React.FC<Props> = ({
  visible,
  onClose,
  currentUserId,
  onDirectOpen,
  onRequested,
}) => {
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // كل ما فتحنا المودال نجيب الأجهزة
  useEffect(() => {
    if (!visible) return;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // GET /api/signal/devices
        const data = await api.get("/signal/devices");
        // نتأكد إنه مصفوفة
        const list: RemoteDevice[] = Array.isArray(data)
          ? data
          : [];

        setDevices(list);
      } catch (e: any) {
        setErr(e?.message || "فشل تحميل الأجهزة");
        setDevices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  // زر "طلب تشغيل" / "فتح"
  const handlePick = async (dev: RemoteDevice) => {
    // هل هذا الجهاز لي؟
    const sameUser =
      (typeof dev.userId === "number" &&
        currentUserId !== null &&
        dev.userId === currentUserId) ||
      dev.isMine === true;

    // لو لنفس الحساب: افتح مباشرة بدون POST
    if (sameUser) {
      onDirectOpen?.(dev);
      onClose();
      return;
    }

    // حساب مختلف → نرسل طلب للباكند
    setBusyId(dev.ownerId);
    setErr(null);
    try {
      // هذا الراوت اللي اتفقنا عليه
      await api.post(`/signal/devices/${dev.ownerId}/attach`);
      onRequested?.(dev);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "فشل إرسال الطلب");
    } finally {
      setBusyId(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-4 space-y-3 border rounded-lg bg-slate-900 border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-white">
            اختر مركبة / جهاز لتشغيل الكاميرا
          </h4>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-100"
          >
            إغلاق
          </button>
        </div>

        {err && (
          <p className="px-3 py-2 text-xs border rounded bg-amber-500/10 text-amber-200 border-amber-500/30">
            {err}
          </p>
        )}

        {loading ? (
          <p className="text-xs text-slate-400">جاري التحميل…</p>
        ) : devices.length === 0 ? (
          <p className="text-xs text-slate-500">ما في أجهزة متاحة حالياً.</p>
        ) : (
          <div className="space-y-2">
            {devices.map((dev) => {
              const isMine =
                (typeof dev.userId === "number" &&
                  currentUserId !== null &&
                  dev.userId === currentUserId) ||
                dev.isMine;

              return (
                <button
                  key={dev.ownerId}
                  onClick={() => handlePick(dev)}
                  disabled={busyId === dev.ownerId}
                  className={`flex items-center justify-between w-full px-3 py-2 text-xs rounded-md bg-slate-800/60 hover:bg-slate-700 transition ${
                    busyId === dev.ownerId ? "opacity-60" : ""
                  }`}
                >
                  <span>
                    {dev.label || "كاميرا جهاز"}
                    <span className="ml-1 text-[9px] text-slate-400">
                      ({dev.ownerId.slice(0, 5)}…)
                    </span>
                    {isMine ? (
                      <span className="ml-2 text-[9px] text-emerald-400">
                        (نفس الحساب)
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[9px] rounded ${
                      busyId === dev.ownerId
                        ? "bg-slate-500 text-slate-100 animate-pulse"
                        : isMine
                        ? "bg-emerald-500/80 text-slate-950"
                        : "bg-emerald-500/80 text-slate-950"
                    }`}
                  >
                    {busyId === dev.ownerId
                      ? "يرسل…"
                      : isMine
                      ? "فتح مباشر"
                      : "طلب تشغيل"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehiclePicker;
