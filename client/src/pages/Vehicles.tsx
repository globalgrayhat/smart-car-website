// src/pages/Vehicles.tsx
// Vehicles page – admin view for available remote devices
// - Fetches /signal/devices over REST (with api wrapper that already has base URL + token)
// - Lets admin send "attach" to other accounts
// - Integrates with MediaContext to show signal status on top
import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { useMedia } from "../media/MediaContext";
import { useAuth } from "../auth/AuthContext";

type RemoteDevice = {
  ownerId: string; // socket.id
  userId: number | null;
  label?: string;
  streamId?: string | null;
  onAir?: boolean;
  isMine?: boolean;
};

const Vehicles: React.FC = () => {
  const media = useMedia() as any;
  const { user } = useAuth();

  const connStatus: "connected" | "connecting" | "disconnected" =
    media?.connStatus ?? "disconnected";
  const lastDisconnect: number | null = media?.lastDisconnect ?? null;

  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentUserId =
    typeof user?.id === "number"
      ? user.id
      : typeof (user as any)?.userId === "number"
        ? (user as any).userId
        : null;

  // load devices once
  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.get("/signal/devices");
      const list: RemoteDevice[] = Array.isArray(data) ? data : [];
      setDevices(list);
    } catch (e: any) {
      setErr(e?.message || "فشل تحميل الأجهزة المتصلة");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAttach = async (dev: RemoteDevice) => {
    // if it's mine → we don't need to ask backend, just show hint
    const same =
      (typeof dev.userId === "number" &&
        currentUserId !== null &&
        dev.userId === currentUserId) ||
      dev.isMine;
    if (same) {
      // in a real UI you could dispatch event to open local camera of that device
      alert("هذا الجهاز لنفس الحساب – افتحه من صفحة التحكّم.");
      return;
    }

    setBusyId(dev.ownerId);
    setErr(null);
    try {
      await api.post(`/signal/devices/${dev.ownerId}/attach`);
    } catch (e: any) {
      setErr(e?.message || "فشل إرسال طلب التشغيل");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">الأجهزة المتصلة</h2>
          <p className="text-sm text-slate-400">
            عرض كل السوكيتات / المركبات المربوطة حالياً على خادم الإشارة.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          إعادة تحميل
        </button>
      </div>

      {/* connection card */}
      <div className="flex items-center gap-2 p-3 border rounded-md bg-slate-900/50 border-slate-800">
        <span
          className={`w-3 h-3 rounded-full ${
            connStatus === "connected"
              ? "bg-emerald-500"
              : connStatus === "connecting"
                ? "bg-amber-400"
                : "bg-red-500"
          }`}
        />
        <span className="text-sm text-white">
          {connStatus === "connected"
            ? "متصل بخادم الإشارة"
            : connStatus === "connecting"
              ? "جارٍ الاتصال بخادم الإشارة…"
              : "غير متصل بالخادم"}
        </span>
        {lastDisconnect && (
          <span className="ml-auto text-[10px] text-slate-500">
            آخر انقطاع: {new Date(lastDisconnect).toLocaleTimeString()}
          </span>
        )}
      </div>

      {err && (
        <div className="px-3 py-2 text-xs border rounded bg-red-500/10 text-red-50 border-red-500/40">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">جاري التحميل…</p>
      ) : devices.length === 0 ? (
        <p className="text-xs text-slate-500">ما في أجهزة متاحة حالياً.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((dev) => {
            const same =
              (typeof dev.userId === "number" &&
                currentUserId !== null &&
                dev.userId === currentUserId) ||
              dev.isMine;
            return (
              <div
                key={dev.ownerId}
                className="p-3 space-y-2 border rounded-lg bg-slate-900/40 border-slate-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {dev.label || "كاميرا جهاز"}
                  </h3>
                  {dev.onAir ? (
                    <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-200">
                      على الهواء
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-200">
                      خاملة
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 break-all">
                  socket: {dev.ownerId}
                </p>
                {typeof dev.userId === "number" && (
                  <p className="text-[10px] text-slate-500">
                    userId: {dev.userId}
                  </p>
                )}
                {dev.streamId && (
                  <p className="text-[10px] text-slate-500">
                    stream: {dev.streamId}
                  </p>
                )}

                <button
                  onClick={() => void handleAttach(dev)}
                  disabled={busyId === dev.ownerId}
                  className={`w-full py-1.5 text-xs rounded ${
                    busyId === dev.ownerId
                      ? "bg-slate-700 text-slate-200 animate-pulse"
                      : same
                        ? "bg-emerald-500/80 text-slate-950"
                        : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                  }`}
                >
                  {busyId === dev.ownerId
                    ? "يرسل الطلب…"
                    : same
                      ? "فتح مباشر (نفس الحساب)"
                      : "طلب تشغيل الكاميرا"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Vehicles;
