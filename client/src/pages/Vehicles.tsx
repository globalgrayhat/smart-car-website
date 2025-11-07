// Vehicles page:
// - Lists registered vehicles for current user from /vehicles.
// - Uses /broadcast/public to highlight which owners have active camera streams.
// - Replaces old /signal/devices and /attach logic.
// - UI text Arabic, comments English.

import React, { useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type PublicSourceKind =
  | "SCREEN"
  | "HOST_CAMERA"
  | "CAR_CAMERA"
  | "GUEST_CAMERA";

type PublicSource = {
  id: number | string;
  title: string | null;
  kind: PublicSourceKind;
  onAir: boolean;
  externalId: string | null;
  ownerId: number | null;
  ownerUserId: number | null;
  ownerSocketId: string | null;
};

type Vehicle = {
  id: number;
  ownerUserId: number;
  name: string;
  apiKey: string;
  isOnline: boolean;
  lastSeen: string | null;
  createdAt: string;
};

const Vehicles: React.FC = () => {
  const { user } = useAuth();
  const u = user as any;

  // Normalize current user id from JWT payload shape
  const currentUserId: number | null =
    (typeof u?.id === "number" && u.id) ||
    (typeof u?.userId === "number" && u.userId) ||
    null;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sources, setSources] = useState<PublicSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /**
   * Fetch:
   * - /vehicles for current user's registered vehicles.
   * - /broadcast/public for active on-air sources (to show which owners have active cameras).
   */
  const load = useCallback(async () => {
    if (!currentUserId) {
      setVehicles([]);
      setSources([]);
      setErr("يجب تسجيل الدخول لعرض المركبات.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const [vehRes, srcRes] = await Promise.all([
        api.get("/vehicles"),
        api.get("/broadcast/public"),
      ]);

      const vList: Vehicle[] = Array.isArray(vehRes) ? vehRes : [];
      const sList: PublicSource[] = Array.isArray(srcRes) ? srcRes : [];

      setVehicles(vList);
      setSources(sList);
    } catch (e: any) {
      setErr(e?.message || "فشل تحميل بيانات المركبات.");
      setVehicles([]);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Helper: check if there is any active camera-like source for given owner
  const hasActiveCameraForOwner = (ownerUserId: number): boolean => {
    return sources.some(
      (s) =>
        s.onAir &&
        s.ownerUserId === ownerUserId &&
        (s.kind === "HOST_CAMERA" ||
          s.kind === "CAR_CAMERA" ||
          s.kind === "GUEST_CAMERA"),
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">
            مركباتي وأجهزة البث
          </h2>
          <p className="text-sm text-slate-400">
            عرض المركبات المسجّلة ومتابعة حالة الاتصال والبث المباشر لكل مركبة.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          إعادة تحميل
        </button>
      </div>

      {/* Error */}
      {err && (
        <div className="px-3 py-2 text-xs border rounded bg-red-500/10 text-red-50 border-red-500/40">
          {err}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <p className="text-xs text-slate-400">جاري التحميل…</p>
      ) : !currentUserId ? (
        <p className="text-xs text-slate-500">
          فضلاً قم بتسجيل الدخول لعرض قائمة المركبات.
        </p>
      ) : vehicles.length === 0 ? (
        <p className="text-xs text-slate-500">
          ما في مركبات مسجّلة حالياً. يمكنك إضافة مركبة من خلال لوحة التحكم
          الخلفية أو API.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => {
            const hasCam = hasActiveCameraForOwner(v.ownerUserId);
            return (
              <div
                key={v.id}
                className="p-3 space-y-2 border rounded-lg bg-slate-900/40 border-slate-800"
              >
                {/* Title and status pills */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {v.name || `مركبة #${v.id}`}
                  </h3>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2 py-0.5 text-[9px] rounded ${
                        v.isOnline
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {v.isOnline ? "متصلة" : "غير متصلة"}
                    </span>
                    {hasCam && (
                      <span className="px-2 py-0.5 text-[9px] rounded bg-red-500/20 text-red-200">
                        بث كاميرا نشط
                      </span>
                    )}
                  </div>
                </div>

                {/* API key & metadata */}
                <p className="text-[10px] text-slate-500 break-all">
                  API Key: {v.apiKey}
                </p>
                {v.lastSeen && (
                  <p className="text-[9px] text-slate-500">
                    آخر ظهور:{" "}
                    {new Date(v.lastSeen).toLocaleString()}
                  </p>
                )}
                <p className="text-[9px] text-slate-600">
                  أضيفت في:{" "}
                  {new Date(v.createdAt).toLocaleDateString()}
                </p>

                {/* Helper action: copy API key */}
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(v.apiKey)
                      .catch(() => null);
                  }}
                  className="w-full py-1.5 mt-1 text-xs rounded bg-slate-800 text-slate-100 hover:bg-slate-700"
                >
                  نسخ مفتاح المركبة
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
