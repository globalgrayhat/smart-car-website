/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BroadcastSources — real-time join status + per-intent states + no duplicates
 * - Per-intent join state (VIEW/CAMERA/SCREEN/ROLE_UPGRADE)
 * - Socket push: "join-requests:status" → instant UI unlock without refresh
 * - After VIEW approved: allowViewNow=true, refresh producers, quality picker visible
 * - Dedupe: don't render the primary video again in the grid list
 * - Publisher: after approve/reject via REST, emit "join:notify" to push UI instantly
 */
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { canPublish, isViewer } from "../auth/roles";
import { api } from "../services/api";
import { useMedia } from "../media/MediaContext";
import { LiveTile } from "../components/LiveTile";

const OWNER_FALLBACK = Number(import.meta.env.VITE_OWNER_USER_ID || "1");

type JoinState = "idle" | "pending" | "approved" | "rejected";
type Intent = "VIEW" | "CAMERA" | "SCREEN" | "ROLE_UPGRADE";

type JoinResp = {
  id?: number | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | null;
  intent?: Intent | null;
  grantedRole?: string | null;
} | null;

type PerIntentStates = Partial<Record<Intent, JoinState>> & {
  /** Keep last raw resp if backend only returns the latest request */
  __last?: JoinResp;
};

type BroadcastSource = {
  id: string | number;
  title?: string | null;
  kind?: string | null; // "camera" | "screen" | "custom"
  ownerId?: number | null;
  ownerUserId?: number | null;
  externalId?: string | null;
};

type JoinRequestItem = {
  id: string | number;
  fromUserId: number | string;
  toUserId?: number | string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | null;
  intent?: Intent | null;
  message?: string | null;
  createdAt?: string | null;
};

const getUserId = (u: unknown): number | null => {
  if (!u) return null;
  const anyUser = u as { id?: number; userId?: number };
  return typeof anyUser.userId === "number"
    ? anyUser.userId
    : typeof anyUser.id === "number"
    ? anyUser.id
    : null;
};

const toJoinState = (st: string | null | undefined): JoinState => {
  if (st === "APPROVED") return "approved";
  if (st === "REJECTED") return "rejected";
  if (st === "PENDING") return "pending";
  return "idle";
};

export default function BroadcastSources() {
  const { user } = useAuth();
  const media = useMedia() as any;

  const socket = media?.socket ?? null;
  const currentUserId = getUserId(user);
  const viewerOnly = isViewer(user?.role);
  const publisher = canPublish(user?.role);

  // mediasoup status / remotes
  const remotes: any[] = Array.isArray(media?.remotes) ? media.remotes : [];
  const mediaStatus: "connected" | "disconnected" | "connecting" =
    (media?.status as any) ?? media?.connStatus ?? "disconnected";
  const videoRemotes = remotes.filter((r) => r.kind === "video");
  const hasVideoRemotes = videoRemotes.length > 0;
  const primaryRemote = videoRemotes[0] || null;

  // local preview fallback
  const localPreviewRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!localPreviewRef.current) return;
    const localStream =
      media?.localCameraStream ||
      media?.localStream ||
      media?.cameraStream ||
      media?.previewStream;
    if (localStream && localPreviewRef.current.srcObject !== localStream) {
      localPreviewRef.current.srcObject = localStream;
    }
  }, [media]);

  // ui state
  const [broadcasts, setBroadcasts] = useState<BroadcastSource[]>([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | number | null>(null);

  /** per-owner per-intent states: { [ownerId]: { VIEW, CAMERA, SCREEN, ROLE_UPGRADE, __last } } */
  const [joinMap, setJoinMap] = useState<Record<string, PerIntentStates>>({});
  const [pendingRequests, setPendingRequests] = useState<JoinRequestItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waitingStale, setWaitingStale] = useState(false);
  const [isStartingLocal, setIsStartingLocal] = useState(false);

  // Quality picker
  const [quality, setQuality] = useState<"Auto" | "144p" | "360p" | "720p+">("Auto");
  useEffect(() => {
    const map: Record<typeof quality, 0 | 1 | 2 | null> = {
      Auto: null,
      "144p": 0,
      "360p": 1,
      "720p+": 2,
    };
    media?.setPreferredQuality?.(map[quality]);
  }, [quality, media]);

  // -------------------------- API --------------------------
  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = (await api.get(`/api/broadcast/all-sources`)) as any[];
      const raw = Array.isArray(res) ? res : [];

      // Drop audio + dedupe per (owner, kind)
      const seen = new Set<string>();
      const clean = raw
        .filter((x) => String(x.kind || "").toLowerCase() !== "audio")
        .filter((x) => {
          const owner = x.ownerUserId || x.ownerId || OWNER_FALLBACK;
          const kind = String(x.kind || "").toLowerCase();
          const key = `${owner}::${kind}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      setBroadcasts(clean);
      setErrorMsg(null);
      if (!selectedBroadcastId && clean.length > 0) {
        setSelectedBroadcastId(clean[0].id);
      }
    } catch {
      setBroadcasts([]);
      setErrorMsg("تعذّر تحميل قائمة البثوث.");
    }
  }, [selectedBroadcastId]);

  const markIntentState = useCallback(
    (ownerId: number, intent: Intent, state: JoinState, last?: JoinResp) => {
      setJoinMap((prev) => {
        const key = String(ownerId);
        const old = prev[key] || {};
        const next: PerIntentStates = { ...old, [intent]: state };
        if (last !== undefined) next.__last = last;
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const fetchJoinForOwner = useCallback(async (ownerId: number) => {
    try {
      const last = (await api.get(`/api/join-requests/last/${ownerId}`)) as JoinResp;
      if (last?.intent) {
        markIntentState(ownerId, last.intent, toJoinState(last.status ?? null), last);
      } else {
        // Unknown intent → treat as idle
        markIntentState(ownerId, "VIEW", "idle", last);
      }
    } catch {
      // ignore
    }
  }, [markIntentState]);

  const fetchPendingRequests = useCallback(async () => {
    if (!publisher) return;
    try {
      const res = (await api.get(`/api/join-requests/my`)) as any[];
      const list = Array.isArray(res) ? res : [];
      setPendingRequests(list.filter((r) => r.status === "PENDING"));
    } catch {
      setPendingRequests([]);
    }
  }, [publisher]);

  // init + polling
  useEffect(() => {
    void fetchBroadcasts();
    void fetchPendingRequests();
  }, [fetchBroadcasts, fetchPendingRequests]);

  useEffect(() => {
    if (!publisher) return;
    const id = setInterval(() => {
      void fetchBroadcasts();
      void fetchPendingRequests();
    }, 5000);
    return () => clearInterval(id);
  }, [publisher, fetchBroadcasts, fetchPendingRequests]);

  // selection → fetch last join for owner
  useEffect(() => {
    if (!selectedBroadcastId) return;
    const b = broadcasts.find((x) => String(x.id) === String(selectedBroadcastId));
    const ownerId = b?.ownerUserId || b?.ownerId || OWNER_FALLBACK;
    if (ownerId) void fetchJoinForOwner(ownerId);
  }, [selectedBroadcastId, broadcasts, fetchJoinForOwner]);

  // derived
  const currentBroadcast = useMemo(
    () => (selectedBroadcastId ? broadcasts.find((b) => String(b.id) === String(selectedBroadcastId)) ?? null : null),
    [selectedBroadcastId, broadcasts],
  );

  const currentOwnerId =
    currentBroadcast?.ownerUserId || currentBroadcast?.ownerId || OWNER_FALLBACK;

  const ownerKey = String(currentOwnerId || OWNER_FALLBACK);
  const perIntent = joinMap[ownerKey] || {};
  const viewState: JoinState = perIntent.VIEW || "idle";

  const isSelfOwner =
    currentOwnerId && currentUserId && Number(currentOwnerId) === Number(currentUserId);

  // strict gating for pure viewers until VIEW approved (unless self/publisher)
  const viewRequiresApproval = viewerOnly && !isSelfOwner && !publisher;
  const allowViewNow =
    !viewRequiresApproval || viewState === "approved" || hasVideoRemotes;

  // Tell MediaContext to gate consumption
  useEffect(() => {
    media?.setViewingAllowed?.(!!allowViewNow);
  }, [media, allowViewNow]);

  // Can publish if approved for CAMERA/SCREEN/ROLE_UPGRADE
  const canPublishNow =
    isSelfOwner ||
    publisher ||
    (perIntent.CAMERA === "approved" || perIntent.SCREEN === "approved" || perIntent.ROLE_UPGRADE === "approved");

  // Wait logic if backend lists broadcasts but no video yet
  const shouldWaitForVideo =
    allowViewNow && !hasVideoRemotes && mediaStatus === "connected" && broadcasts.length > 0;

  useEffect(() => {
    if (!shouldWaitForVideo) {
      setWaitingStale(false);
      return;
    }
    if (typeof media?.refreshProducers === "function") {
      void media.refreshProducers();
    }
    const t = setTimeout(() => {
      if (!hasVideoRemotes) setWaitingStale(true);
    }, 7000);
    return () => clearTimeout(t);
  }, [shouldWaitForVideo, media, hasVideoRemotes]);

  // ---------------------- socket: live join status ----------------------
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const onJoinStatus = async (payload: {
      toUserId: number;
      status: "APPROVED" | "REJECTED";
      intent: Intent;
      requestId?: string | number | null;
    }) => {
      // Only care if it's for me
      if (Number(payload.toUserId) !== Number(currentUserId)) return;

      // Update local per-intent state
      const st = payload.status === "APPROVED" ? "approved" : "rejected";
      if (currentOwnerId) {
        markIntentState(currentOwnerId, payload.intent, st);
      }

      // If VIEW approved → unlock immediately and refresh producers
      if (payload.intent === "VIEW" && payload.status === "APPROVED") {
        media?.setViewingAllowed?.(true);
        // Pull producers to start consumption instantly
        if (typeof media?.refreshProducers === "function") {
          await media.refreshProducers();
        }
      }
    };

    socket.on("join-requests:status", onJoinStatus);
    return () => {
      socket.off("join-requests:status", onJoinStatus);
    };
  }, [socket, currentUserId, currentOwnerId, media, markIntentState]);

  // ---------------------- join actions ----------------------
  const canSendJoin = (ownerId: number, intent: Intent): boolean => {
    if (!ownerId) return false;
    if (currentUserId && Number(currentUserId) === Number(ownerId)) return false; // I'm the owner
    const st = (joinMap[String(ownerId)] || {})[intent] || "idle";
    // Block only if THIS intent is pending/approved; other intents are independent
    if (st === "pending" || st === "approved") return false;
    return true;
  };

  const sendJoin = async (intent: Intent) => {
    if (!currentOwnerId) return;
    if (!canSendJoin(currentOwnerId, intent)) return;
    try {
      // Optimistic pending
      markIntentState(currentOwnerId, intent, "pending");
      await api.post(`/api/broadcast/request/${intent.toLowerCase()}`, {
        toUserId: currentOwnerId,
        message:
          intent === "CAMERA"
            ? "أرغب بمشاركة الكاميرا."
            : intent === "SCREEN"
            ? "أرغب بمشاركة الشاشة."
            : intent === "ROLE_UPGRADE"
            ? "أرغب بالترقية على هذا البث."
            : "أرغب بمشاهدة هذا البث.",
      });
      // Backend may only store "last" → refresh just in case
      void fetchJoinForOwner(currentOwnerId);
      setErrorMsg(null);
    } catch {
      // revert to idle on failure
      markIntentState(currentOwnerId, intent, "idle");
      setErrorMsg("تعذّر إرسال الطلب. حاول لاحقًا.");
    }
  };

  // ---------------------- publisher moderation (push notify) ----------------------
  const approveJoin = async (req: JoinRequestItem) => {
    try {
      await api.post(`/api/join-requests/${req.id}/approve`, {});
      setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
      // Push live status to the target viewer
      media?.socket?.emit?.("join:notify", {
        toUserId: Number(req.fromUserId),
        status: "APPROVED",
        intent: (req.intent || "VIEW") as Intent,
        requestId: req.id,
      });
    } catch {
      setErrorMsg("تعذّر اعتماد الطلب.");
    }
  };

  const rejectJoin = async (req: JoinRequestItem) => {
    try {
      await api.post(`/api/join-requests/${req.id}/reject`, {});
      setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
      // Push live status
      media?.socket?.emit?.("join:notify", {
        toUserId: Number(req.fromUserId),
        status: "REJECTED",
        intent: (req.intent || "VIEW") as Intent,
        requestId: req.id,
      });
    } catch {
      setErrorMsg("تعذّر رفض الطلب.");
    }
  };

  // ---------------------- tiles (no duplicate of primary) ----------------------
  const tiles = useMemo(
    () =>
      videoRemotes.map((r: any) => {
        const id = String(r.producerId || r.id || r.streamId || r.externalId || Math.random().toString(36));
        return {
          id,
          kind: "video" as const,
          peerId: r.peerId as string | undefined,
          title: r.label
            ? r.label
            : `VIDEO • peer:${String(r.peerId ?? r.ownerId ?? "remote").slice(0, 6)}`,
        };
      }),
    [videoRemotes],
  );

  const activeRemote = primaryRemote;
  const activeId = activeRemote ? String(activeRemote.producerId ?? activeRemote.id ?? activeRemote.streamId) : null;
  const gridTiles = tiles.filter((t) => t.id !== activeId); // drop the main one

  // ui helpers
  const startLocalCamera = async () => {
    if (!canPublishNow) return;
    try {
      setIsStartingLocal(true);
      await media?.startCamera?.({ withAudio: true });
    } finally {
      setTimeout(() => setIsStartingLocal(false), 450);
    }
  };

  // main viewer render
  const renderMainViewer = () => {
    if (viewRequiresApproval && !allowViewNow) {
      return (
        <div className="relative flex flex-col items-center justify-center w-full h-full gap-3 overflow-hidden text-center bg-black">
          <div className="absolute inset-0 bg-[url('/placeholder-frame.webp')] bg-cover bg-center opacity-30" />
          <div className="relative z-10 px-3 py-1 text-sm rounded bg-slate-950/70 text-slate-100">هذه قناة خاصة. بانتظار الموافقة.</div>
          <p className="relative z-10 text-[11px] text-slate-400">أرسل طلب مشاهدة ليتم تفعيل البث لديك.</p>
        </div>
      );
    }

    if (mediaStatus === "connecting") {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-3">
          <div className="w-10 h-10 border-2 rounded-full border-slate-500/40 border-t-emerald-300 animate-spin" />
          <p className="text-xs text-slate-300">جارٍ تهيئة الاتصال…</p>
        </div>
      );
    }

    if (isStartingLocal) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-3">
          <div className="w-10 h-10 border-2 rounded-full border-slate-500/40 border-t-emerald-300 animate-spin" />
          <p className="text-xs text-slate-300">تشغيل الكاميرا…</p>
        </div>
      );
    }

    if (hasVideoRemotes && activeRemote) {
      return (
        <div className="relative">
          {/* Quality picker overlay */}
          <div className="absolute z-20 flex items-center gap-1 p-1 border rounded bottom-2 left-2 bg-slate-900/70 border-slate-700">
            <span className="px-1 text-[10px] text-slate-300">الجودة</span>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as any)}
              className="px-2 py-[2px] text-[10px] rounded bg-slate-800 text-slate-100 border border-slate-600"
            >
              <option>Auto</option>
              <option>144p</option>
              <option>360p</option>
              <option>720p+</option>
            </select>
          </div>

          <LiveTile
            key={activeId!}
            producerId={activeId!}
            kind="video"
            title={currentBroadcast?.title || "بث مباشر"}
            isPrimary
            hideChrome
            zoomable
            peerId={activeRemote.peerId}
          />
        </div>
      );
    }

    if (shouldWaitForVideo && !waitingStale) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
          <div className="border-2 rounded-full w-9 h-9 border-slate-500/40 border-t-emerald-200 animate-spin" />
          <p className="px-3 py-1 text-sm rounded bg-slate-950/80 text-slate-100">
            تم العثور على بث، بانتظار وصول الفيديو…
          </p>
          <p className="text-[11px] text-slate-500">
            إذا استمر هذا، فصاحب البث لم يفعّل الكاميرا عبر mediasoup.
          </p>
        </div>
      );
    }

    if (shouldWaitForVideo && waitingStale) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
          <p className="px-3 py-1 text-sm rounded bg-slate-950/80 text-slate-100">البث غير متاح حاليًا.</p>
          <p className="text-[11px] text-slate-500">اطلب من صاحب البث تشغيل الكاميرا فعليًا، أو أعد فتح الصفحة.</p>
        </div>
      );
    }

    if (media?.localCameraStream) {
      return (
        <video
          ref={localPreviewRef}
          className="object-contain w-full h-full bg-black"
          autoPlay
          muted
          playsInline
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
        <p className="px-3 py-1 text-sm rounded bg-slate-950/60 text-slate-100">لا يوجد تيار جاهز للعرض.</p>
        <p className="text-[11px] text-slate-500">تأكد أن جهاز ما يبث فعليًا عبر mediasoup.</p>
      </div>
    );
  };

  // render
  return (
    <div className="grid gap-4 lg:grid-cols-12 animate-fadeIn">
      {/* LEFT */}
      <div className="space-y-4 lg:col-span-8">
        <div>
          <h1 className="text-xl font-bold text-white">مصادر البث</h1>
          <p className="text-sm text-slate-400">عرض رئيسي، اختيار مصدر، وتحكم الجودة.</p>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
            mediaStatus === "connected"
              ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30"
              : mediaStatus === "connecting"
              ? "bg-amber-500/10 text-amber-100 border border-amber-500/30"
              : "bg-red-500/10 text-red-200 border border-red-500/30"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              mediaStatus === "connected" ? "bg-emerald-400" : mediaStatus === "connecting" ? "bg-amber-400" : "bg-red-400"
            }`}
          />
          {mediaStatus === "connected" ? "متصل بخادم البث." : mediaStatus === "connecting" ? "جارٍ الاتصال بخادم البث…" : "غير متصل بخادم البث."}
        </div>

        {errorMsg ? (
          <div className="px-4 py-2 text-xs border rounded-md bg-red-500/10 border-red-500/30 text-red-50">{errorMsg}</div>
        ) : null}

        <div className="relative w-full overflow-hidden border rounded-lg bg-slate-950/40 border-slate-800 aspect-video min-h-[280px] md:min-h-[340px] lg:min-h-[400px]">
          {renderMainViewer()}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">جميع الوسائط المتاحة</h2>
            <button
              onClick={() => void media?.refreshProducers?.()}
              className="text-[11px] rounded bg-slate-800 text-slate-200 px-2 py-1 border border-slate-700"
            >
              تحديث
            </button>
          </div>
          {!allowViewNow ? (
            <p className="text-xs text-slate-500">الرجاء طلب الإذن بالمشاهدة أولًا.</p>
          ) : gridTiles.length === 0 ? (
            <p className="text-xs text-slate-500">لا توجد تدفقات نشطة حالياً.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {gridTiles.map((t) => (
                <div key={t.id} className="overflow-hidden border rounded-lg border-slate-800 bg-slate-950/40">
                  <LiveTile producerId={t.id} kind={t.kind} title={t.title} className="bg-black" />
                  <div className="px-2 py-1 text-[10px] bg-slate-900 text-slate-300">{t.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="space-y-4 lg:col-span-4">
        {/* Viewer join UI (per-intent buttons) */}
        {viewerOnly && !isSelfOwner && (
          <div className="flex flex-col gap-2 px-4 py-2 text-xs border rounded-md bg-slate-800/40 border-slate-700 text-slate-200">
            <span>طلبات منفصلة حسب الغرض:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void sendJoin("VIEW")}
                disabled={!canSendJoin(currentOwnerId!, "VIEW")}
                className="text-[11px] rounded bg-emerald-500 text-slate-950 px-3 py-1 disabled:opacity-50"
              >
                طلب مشاهدة
              </button>
              <button
                onClick={() => void sendJoin("CAMERA")}
                disabled={!canSendJoin(currentOwnerId!, "CAMERA")}
                className="text-[11px] rounded bg-slate-700 text-slate-50 px-3 py-1 disabled:opacity-50"
              >
                طلب مشاركة كاميرا
              </button>
              <button
                onClick={() => void sendJoin("SCREEN")}
                disabled={!canSendJoin(currentOwnerId!, "SCREEN")}
                className="text-[11px] rounded bg-indigo-500 text-white px-3 py-1 disabled:opacity-50"
              >
                طلب مشاركة شاشة
              </button>
              <button
                onClick={() => void sendJoin("ROLE_UPGRADE")}
                disabled={!canSendJoin(currentOwnerId!, "ROLE_UPGRADE")}
                className="text-[11px] rounded bg-fuchsia-600 text-white px-3 py-1 disabled:opacity-50"
              >
                طلب ترقية
              </button>
            </div>

            {/* Small state line */}
            <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
              <span>مشاهدة: {viewState}</span>
              <span>كاميرا: {perIntent.CAMERA || "idle"}</span>
              <span>شاشة: {perIntent.SCREEN || "idle"}</span>
              <span>ترقية: {perIntent.ROLE_UPGRADE || "idle"}</span>
            </div>
          </div>
        )}

        {/* Publisher controls */}
        {canPublishNow && (
          <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg border-slate-800 bg-slate-900/40">
            {!media?.camera?.isOn && (
              <button onClick={() => void startLocalCamera()} className="text-[11px] rounded bg-emerald-500 text-slate-950 px-3 py-1">
                تشغيل الكاميرا + الميكروفون
              </button>
            )}
            {media?.camera?.isOn && (
              <>
                <button onClick={() => void media?.stopCamera?.()} className="text-[11px] rounded bg-slate-800 text-slate-100 px-3 py-1">
                  إيقاف الكاميرا
                </button>
                <button
                  onClick={() => void media?.camera?.toggleMic?.()}
                  className={`text-[11px] rounded px-3 py-1 ${
                    media?.camera?.micMuted ? "bg-amber-500 text-slate-900" : "bg-slate-700 text-slate-50"
                  }`}
                >
                  {media?.camera?.micMuted ? "تشغيل المايك" : "كتم المايك"}
                </button>
              </>
            )}
            <span className="w-px h-4 mx-2 bg-slate-700" />
            <button onClick={() => void media?.startScreen?.()} className="text-[11px] rounded bg-indigo-500 text-white px-3 py-1">
              مشاركة الشاشة
            </button>
            <button onClick={() => void media?.stopScreen?.()} className="text-[11px] rounded bg-slate-800 text-slate-100 px-3 py-1">
              إيقاف المشاركة
            </button>
            <span className="w-px h-4 mx-2 bg-slate-700" />
            <button onClick={() => void media?.endBroadcast?.()} className="text-[11px] rounded bg-red-600 text-white px-3 py-1">
              إنهاء البث
            </button>
          </div>
        )}

        {/* Admin: join requests */}
        {publisher && (
          <div className="p-3 border rounded-lg border-slate-800 bg-slate-900/30">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-200">طلبات الانضمام</h2>
              <span className="text-[10px] text-slate-500">{pendingRequests.length} طلب</span>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-[11px] text-slate-500">لا توجد طلبات حالية.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pendingRequests.map((req) => (
                  <li key={req.id} className="flex items-center justify-between gap-3 px-3 py-2 border rounded-md bg-slate-950/40 border-slate-800">
                    <div>
                      <p className="text-xs text-slate-100">المستخدم #{req.fromUserId}</p>
                      <p className="text-[10px] text-slate-500">{req.message || "لا يوجد نص مرفق."}</p>
                      <p className="text-[9px] text-slate-500 mt-1">
                        نوع الطلب: {req.intent === "ROLE_UPGRADE" ? "طلب ترقية" : req.intent === "SCREEN" ? "طلب مشاركة شاشة" : req.intent === "CAMERA" ? "طلب مشاركة كاميرا" : "طلب مشاهدة"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void approveJoin(req)} className="text-[10px] px-2 py-1 rounded bg-emerald-500 text-slate-950">
                        موافقة
                      </button>
                      <button onClick={() => void rejectJoin(req)} className="text-[10px] px-2 py-1 rounded bg-red-500/80 text-white">
                        رفض
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Broadcasts list */}
        <div className="p-3 border rounded-lg border-slate-800 bg-slate-900/30">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">البثوث الحالية</h2>
          {broadcasts.length === 0 ? (
            <p className="text-[11px] text-slate-500">لا توجد بيانات بث.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {broadcasts.map((b) => {
                const ownerId = b.ownerUserId || b.ownerId || OWNER_FALLBACK;
                const stView = (joinMap[String(ownerId)] || {}).VIEW || "idle";
                const isSelected = String(selectedBroadcastId) === String(b.id);
                return (
                  <li
                    key={b.id}
                    onClick={() => setSelectedBroadcastId(b.id)}
                    className={`flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer transition ${
                      isSelected ? "bg-slate-900 border-emerald-500/40" : "bg-slate-950/40 border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div>
                      <p className="text-xs text-slate-100">{b.title || `بث رقم #${b.id}`}</p>
                      <p className="text-[10px] text-slate-500">
                        {(b.kind || "STREAM").toUpperCase()} {ownerId ? `• المالك: ${ownerId}` : ""}{" "}
                        {stView === "approved" ? "• مصرح بالمشاهدة" : stView === "pending" ? "• بانتظار الموافقة" : ""}
                      </p>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-emerald-400" : "bg-emerald-400/40"} animate-pulse`} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
