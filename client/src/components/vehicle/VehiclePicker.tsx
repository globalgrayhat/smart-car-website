/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * VehiclePicker
 *
 * Modal that lists active broadcast devices (host/vehicle/screen) from /broadcast/public.
 * - Ignores audio-only sources.
 * - If the selected device belongs to current user → direct open.
 * - Otherwise delegates request handling to parent via onRequested.
 */

import React, { useEffect, useState } from "react";
import { api } from "../../services/api";

export type RemoteDevice = {
  ownerId: string;
  userId: number | null;
  label: string;
  kind: string;
  onAir: boolean;
  isMine: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUserId: number | null;
  onDirectOpen?: (dev: RemoteDevice) => void;
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

  useEffect(() => {
    if (!visible) return;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api.get("/broadcast/public");
        const list = Array.isArray(res) ? res : [];

        const mapped: RemoteDevice[] = list
          .filter((s: any) => {
            if (!s || !s.onAir) return false;
            const kind = String(s.kind || "").toUpperCase();
            const title = String(s.title || "").toLowerCase();
            if (title.includes("audio") || kind.includes("AUDIO")) return false;
            return (
              kind === "HOST_CAMERA" ||
              kind === "CAR_CAMERA" ||
              kind === "SCREEN"
            );
          })
          .map((s: any) => {
            const ownerUserId =
              typeof s.ownerUserId === "number" ? s.ownerUserId : null;
            const isMine =
              currentUserId != null &&
              ownerUserId != null &&
              Number(ownerUserId) === Number(currentUserId);

            const id: string =
              (s.externalId && String(s.externalId)) ||
              (s.ownerSocketId && String(s.ownerSocketId)) ||
              String(s.id);

            return {
              ownerId: id,
              userId: ownerUserId,
              label:
                s.title ||
                (String(s.kind || "").toUpperCase() === "CAR_CAMERA"
                  ? "كاميرا مركبة"
                  : String(s.kind || "").toUpperCase() === "SCREEN"
                  ? "مشاركة شاشة"
                  : "كاميرا المضيف"),
              kind: String(s.kind || ""),
              onAir: !!s.onAir,
              isMine,
            };
          });

        setDevices(mapped);
      } catch (e: any) {
        setErr(e?.message || "تعذّر تحميل قائمة الأجهزة النشطة.");
        setDevices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, currentUserId]);

  const handlePick = async (dev: RemoteDevice) => {
    const sameUser =
      dev.isMine ||
      (typeof dev.userId === "number" &&
        currentUserId != null &&
        dev.userId === currentUserId);

    if (sameUser) {
      onDirectOpen?.(dev);
      onClose();
      return;
    }

    setBusyId(dev.ownerId);
    setErr(null);

    try {
      onRequested?.(dev);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "تعذّر إرسال طلب الارتباط.");
    } finally {
      setBusyId(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md p-4 space-y-3 border shadow-2xl rounded-xl bg-slate-900/95 border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-white">
            اختيار مركبة أو جهاز للبث
          </h4>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-100 hover:bg-slate-700"
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
          <p className="text-xs text-slate-400">جاري تحميل المصادر النشطة…</p>
        ) : devices.length === 0 ? (
          <p className="text-xs text-slate-500">
            لا توجد كاميرات أو شاشات نشطة حالياً.
          </p>
        ) : (
          <div className="space-y-2">
            {devices.map((dev) => {
              const isMine =
                dev.isMine ||
                (typeof dev.userId === "number" &&
                  currentUserId != null &&
                  dev.userId === currentUserId);

              return (
                <button
                  key={dev.ownerId}
                  onClick={() => void handlePick(dev)}
                  disabled={busyId === dev.ownerId}
                  className={`flex items-center justify-between w-full px-3 py-2 text-xs rounded-md bg-slate-800/70 hover:bg-slate-700 transition ${
                    busyId === dev.ownerId ? "opacity-60" : ""
                  }`}
                >
                  <span className="flex flex-col text-right">
                    <span className="text-slate-100">{dev.label}</span>
                    <span className="text-[9px] text-slate-500">
                      معرف المصدر: {dev.ownerId.slice(0, 8)}…
                      {isMine && " • نفس حساب الإدارة"}
                    </span>
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[9px] rounded ${
                      busyId === dev.ownerId
                        ? "bg-slate-500 text-slate-100 animate-pulse"
                        : "bg-emerald-500/90 text-slate-950"
                    }`}
                  >
                    {busyId === dev.ownerId
                      ? "جاري الإرسال..."
                      : isMine
                      ? "فتح مباشر"
                      : "اختيار"}
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
