/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BroadcastSources
 *
 * Responsive, system-friendly live broadcast center:
 * - Displays all active broadcasts from /broadcast/public.
 * - Single integrated viewing experience (primary video).
 * - Owner/admin can publish directly from the same interface.
 * - Viewers can send VIEW/CONTROL requests, with real-time updates via WebSocket.
 * - Polished responsive layout (mobile/tablet/desktop), sticky sidebar on large screens,
 *   safe-area aware paddings, and accessible controls.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { canPublish, isViewer } from "../auth/roles";
import { api } from "../services/api";
import { useMedia } from "../media/MediaContext";
import { LiveTile } from "../components/LiveTile";

type Intent = "VIEW" | "CONTROL";
type JoinState = "idle" | "pending" | "approved" | "rejected";

type BroadcastSource = {
  id: number;
  title?: string | null;
  kind?: string | null;
  onAir?: boolean;
  externalId?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
};

type JoinRequestItem = {
  id: number;
  fromUserId: number;
  intent: Intent;
  status: "PENDING" | "APPROVED" | "REJECTED";
  message?: string | null;
  broadcastId?: number | null;
};

const getUserId = (u: any): number | null =>
  u && (typeof u.userId === "number" ? u.userId : typeof u.id === "number" ? u.id : null);

const labelForKind = (kind?: string | null) => {
  const k = (kind || "").toUpperCase();
  if (k === "SCREEN") return "مشاركة شاشة";
  if (k === "CAR_CAMERA") return "كاميرا مركبة";
  if (k === "HOST_CAMERA") return "كاميرا المضيف";
  if (k === "GUEST_CAMERA") return "كاميرا ضيف";
  return "بث مباشر";
};

const BroadcastSources: React.FC = () => {
  const { user } = useAuth();
  const media = useMedia() as any;

  const socket: any = media?.socket ?? null;
  const userId = getUserId(user);

  const viewerOnly = isViewer(user?.role);
  const publisherRole = canPublish(user?.role);

  // Normalize media connection status
  const mediaStatus: "connected" | "connecting" | "disconnected" =
    media?.connStatus ?? media?.status ?? "disconnected";

  // Remotes from MediaContext
  const remotes: any[] = Array.isArray(media?.remotes) ? media.remotes : [];

  // Choose first video remote as primary
  const videoRemotes = remotes.filter((r) => r.kind === "video");
  const primary = videoRemotes[0] || null;

  // /broadcast/public data
  const [broadcasts, setBroadcasts] = useState<BroadcastSource[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Join request states (for current user)
  const [joinStateView, setJoinStateView] = useState<JoinState>("idle");
  const [joinStateControl, setJoinStateControl] = useState<JoinState>("idle");

  // Pending requests (for owner/admin)
  const [pending, setPending] = useState<JoinRequestItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isStartingCam, setIsStartingCam] = useState(false);
  const [waitingVideo, setWaitingVideo] = useState(false);

  // Local preview (if owner publishes from here)
  const localPreviewRef = useRef<HTMLVideoElement | null>(null);

  /** Current broadcast */
  const currentBroadcast: BroadcastSource | null = useMemo(
    () =>
      selectedId != null
        ? broadcasts.find((b) => b.id === selectedId) || null
        : broadcasts[0] || null,
    [broadcasts, selectedId]
  );

  const currentOwnerId = currentBroadcast?.ownerUserId ?? null;

  const isOwner = !!userId && !!currentOwnerId && Number(userId) === Number(currentOwnerId);

  // Always allowed viewers (owner/admin)
  const canAlwaysView = !!userId && (publisherRole || isOwner);

  // Effective view permission
  const allowView = canAlwaysView || joinStateView === "approved";

  // Effective publish/control permission
  const canPublishNow = canAlwaysView || joinStateControl === "approved";

  /** Load active broadcasts */
  const loadBroadcasts = useCallback(async () => {
    try {
      const res = await api.get("/broadcast/public");
      const list: any[] = Array.isArray(res) ? res : [];

      const clean: BroadcastSource[] = list
        .filter((x) => x && x.onAir && String(x.kind || "").toUpperCase() !== "AUDIO")
        .map((x) => ({
          id: Number(x.id),
          title: x.title || null,
          kind: x.kind || null,
          onAir: !!x.onAir,
          externalId: x.externalId || null,
          ownerUserId:
            typeof x.ownerUserId === "number"
              ? x.ownerUserId
              : typeof x.ownerId === "number"
              ? x.ownerId
              : null,
          ownerName: x.ownerName || null,
        }));

      setBroadcasts(clean);
      if (!selectedId && clean[0]) setSelectedId(clean[0].id);
      setError(null);
    } catch (e: any) {
      setBroadcasts([]);
      setError(e?.message || "تعذّر تحميل قائمة البثوث.");
    }
  }, [selectedId]);

  /** Load my pending join-requests (publisher/admin) */
  const loadMyPending = useCallback(async () => {
    if (!publisherRole) return;
    try {
      const res = await api.get("/join-requests/my");
      const list: any[] = Array.isArray(res) ? res : [];
      setPending(list.filter((r) => r && r.status === "PENDING" && r.intent && r.id));
    } catch {
      setPending([]);
    }
  }, [publisherRole]);

  /** Load last join state between me and the owner */
  const loadLastJoin = useCallback(
    async (ownerId?: number | null) => {
      if (!ownerId || !userId) return;
      if (Number(ownerId) === Number(userId)) return;

      try {
        const res: any = await api.get(`/join-requests/last/${ownerId}`);

        if (!res || res.status === "NONE") {
          setJoinStateView("idle");
          setJoinStateControl("idle");
          return;
        }

        const st: JoinState =
          res.status === "APPROVED" ? "approved" : res.status === "REJECTED" ? "rejected" : "pending";

        if (res.intent === "VIEW") setJoinStateView(st);
        if (res.intent === "CONTROL") setJoinStateControl(st);
      } catch {
        // ignore
      }
    },
    [userId]
  );

  /** Initial load */
  useEffect(() => {
    void loadBroadcasts();
    void loadMyPending();
  }, [loadBroadcasts, loadMyPending]);

  /** Periodic light sync on large screens (publisher/admin) */
  useEffect(() => {
    if (!publisherRole) return;
    const id = setInterval(() => {
      void loadBroadcasts();
      void loadMyPending();
    }, 5000);
    return () => clearInterval(id);
  }, [publisherRole, loadBroadcasts, loadMyPending]);

  /** When broadcast changes, refresh my join state against its owner */
  useEffect(() => {
    if (!currentBroadcast) return;
    void loadLastJoin(currentBroadcast.ownerUserId);
  }, [currentBroadcast?.id, currentBroadcast?.ownerUserId, loadLastJoin]);

  /** Listen to WebSocket updates for join-requests */
  useEffect(() => {
    if (!socket || !userId) return;

    const handler = (p: { toUserId: number; status: "APPROVED" | "REJECTED"; intent: Intent }) => {
      if (Number(p.toUserId) !== Number(userId)) return;

      const st: JoinState = p.status === "APPROVED" ? "approved" : "rejected";

      if (p.intent === "VIEW") {
        setJoinStateView(st);
        if (p.status === "APPROVED") {
          media?.setViewingAllowed?.(true);
          media?.refreshProducers?.();
        }
      }

      if (p.intent === "CONTROL") setJoinStateControl(st);
    };

    socket.on("join-requests:status", handler);
    return () => {
      socket.off("join-requests:status", handler);
    };
  }, [socket, userId, media]);

  /** Can send join for current broadcast? */
  const canSendJoin = (intent: Intent): boolean => {
    if (!currentBroadcast || !currentBroadcast.ownerUserId || !userId) return false;
    if (Number(userId) === Number(currentBroadcast.ownerUserId)) return false;

    const state = intent === "VIEW" ? joinStateView : joinStateControl;
    return state === "idle" || state === "rejected";
  };

  /** Send join-request */
  const sendJoin = async (intent: Intent) => {
    if (!currentBroadcast || !currentBroadcast.ownerUserId || !userId) return;
    if (!canSendJoin(intent)) return;

    const setState = intent === "VIEW" ? setJoinStateView : setJoinStateControl;
    setState("pending");

    try {
      await api.post("/join-requests", {
        toUserId: currentBroadcast.ownerUserId,
        intent,
        broadcastId: currentBroadcast.id,
        message:
          intent === "VIEW"
            ? `أرغب في مشاهدة البث رقم ${currentBroadcast.id}.`
            : "أرغب في التحكم بالمركبة المرتبطة بهذا البث.",
      });
      setError(null);
    } catch {
      setState("idle");
      setError("تعذّر إرسال الطلب. يرجى المحاولة لاحقًا.");
    }
  };

  /** Approve join (owner/admin) */
  const approveJoin = async (req: JoinRequestItem) => {
    try {
      await api.post(`/join-requests/${req.id}/approve`);
      setPending((prev) => prev.filter((r) => r.id !== req.id));
      socket?.emit?.("join:notify", {
        toUserId: req.fromUserId,
        status: "APPROVED",
        intent: req.intent,
        requestId: req.id,
      });
    } catch {
      setError("تعذّر اعتماد الطلب. يرجى المحاولة لاحقًا.");
    }
  };

  /** Reject join (owner/admin) */
  const rejectJoin = async (req: JoinRequestItem) => {
    try {
      await api.post(`/join-requests/${req.id}/reject`);
      setPending((prev) => prev.filter((r) => r.id !== req.id));
      socket?.emit?.("join:notify", {
        toUserId: req.fromUserId,
        status: "REJECTED",
        intent: req.intent,
        requestId: req.id,
      });
    } catch {
      setError("تعذّر رفض الطلب. يرجى المحاولة لاحقًا.");
    }
  };

  /** Start camera locally (owner) */
  const startCamera = async () => {
    if (!canPublishNow) return;
    setIsStartingCam(true);
    try {
      await media?.startCamera?.({ withAudio: true });
    } finally {
      setTimeout(() => setIsStartingCam(false), 300);
    }
  };

  /** Attach local preview if available */
  useEffect(() => {
    if (!localPreviewRef.current) return;

    const stream =
      media?.localCameraStream || media?.localStream || media?.previewStream || media?.cameraStream;

    if (stream && localPreviewRef.current.srcObject !== stream) {
      localPreviewRef.current.srcObject = stream;
    }
  }, [media]);

  /** Publish viewing permission to MediaContext */
  useEffect(() => {
    media?.setViewingAllowed?.(!!allowView);
    if (allowView && mediaStatus === "connected") media?.refreshProducers?.();
  }, [allowView, mediaStatus, media]);

  /** Manage waiting state for video */
  useEffect(() => {
    if (!currentBroadcast || !allowView || mediaStatus !== "connected") {
      setWaitingVideo(false);
      return;
    }

    if (videoRemotes.length > 0) {
      setWaitingVideo(false);
      return;
    }

    setWaitingVideo(true);
    media?.refreshProducers?.();
  }, [currentBroadcast?.id, allowView, mediaStatus, videoRemotes.length, media]);

  /**
   * Render: Main Playback Area
   * - Mobile: full width, capped height with svh.
   * - Desktop: fills the left column, sticky controls remain visible.
   */
  const renderMain = () => {
    // Viewer-only user without permission
    if (viewerOnly && !allowView) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
          <p className="px-3 py-1 text-sm rounded bg-slate-950/80 text-slate-100">
            هذا البث خاص. يرجى إرسال طلب مشاهدة للحصول على الإذن.
          </p>
          <p className="text-[11px] text-slate-500">اختر البث من القائمة ثم اضغط "طلب مشاهدة".</p>
        </div>
      );
    }

    // Connecting / initializing
    if (mediaStatus === "connecting" || isStartingCam) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-3">
          <div className="w-10 h-10 border-2 rounded-full border-t-emerald-400 border-slate-600/40 animate-spin" />
          <p className="text-xs text-slate-300">جارٍ تهيئة الاتصال بنظام البث المباشر…</p>
        </div>
      );
    }

    // Primary video is ready and viewing allowed
    if (primary && allowView) {
      const activeId = primary.producerId || primary.id || primary.streamId;
      return (
        <LiveTile
          producerId={String(activeId)}
          kind="video"
          isPrimary
          zoomable
          title={currentBroadcast?.title || labelForKind(currentBroadcast?.kind)}
          peerId={primary.peerId}
        />
      );
    }

    // Waiting for video after approval
    if (waitingVideo && allowView) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
          <div className="w-8 h-8 border-2 rounded-full border-t-emerald-300 border-slate-600/40 animate-spin" />
          <p className="px-3 py-1 text-sm rounded bg-slate-950/80 text-slate-100">
            تم اختيار البث — ننتظر بدء إرسال الفيديو من مالك البث.
          </p>
        </div>
      );
    }

    // Local preview for owner
    if (media?.localCameraStream && canPublishNow) {
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

    // Fallback
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
        <p className="px-3 py-1 text-sm rounded bg-slate-950/70 text-slate-100">لا يوجد تيار متاح للعرض حاليًا.</p>
        <p className="text-[11px] text-slate-500">تأكد من وجود بث فعال أو تشغيل كاميرا مالك البث.</p>
      </div>
    );
  };

  /**
   * Layout notes:
   * - Uses 'svh' units to fit mobile viewports with browser UI considered.
   * - Sidebar becomes sticky on lg+ so requests/tools stay visible.
   * - Independent scroll: main area and sidebar sections avoid page jumps.
   */
  return (
    <div className="space-y-4 animate-fadeIn px-[max(env(safe-area-inset-left),0.75rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),0.75rem)]">
      {/* Page header */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-white">مركز البث المباشر</h1>
        <p className="text-sm text-slate-400">
          تجربة موحّدة لمتابعة البثوث النشطة، إدارة صلاحيات المشاهدة والتحكم، وتشغيل كاميرا المضيف من نفس
          الواجهة.
        </p>
      </header>

      {/* Connection status */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-[11px] border ${
          mediaStatus === "connected"
            ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/40"
            : mediaStatus === "connecting"
            ? "bg-amber-500/10 text-amber-100 border-amber-500/40"
            : "bg-red-500/10 text-red-200 border-red-500/40"
        }`}
        role="status"
        aria-live="polite"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            mediaStatus === "connected" ? "bg-emerald-400" : mediaStatus === "connecting" ? "bg-amber-400" : "bg-red-400"
          }`}
        />
        {mediaStatus === "connected"
          ? "متصل بخادم البث."
          : mediaStatus === "connecting"
          ? "جارٍ الاتصال بخادم البث…"
          : "غير متصل بخادم البث."}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 text-xs border rounded-md bg-red-500/10 border-red-500/30 text-red-50" role="alert">
          {error}
        </div>
      )}

      {/* Main grid: on mobile it's stacked; on desktop it's two columns with sticky sidebar */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Main area */}
        <section className="space-y-4 lg:col-span-8">
          <div
            className="
              relative w-full overflow-hidden border rounded-lg
              bg-slate-950/40 border-slate-800
              min-h-[220px] md:min-h-[280px]
              h-[min(75svh,75vh)] md:h-[min(78svh,78vh)]
            "
          >
            {renderMain()}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-[max(env(safe-area-inset-top),0.75rem)] self-start">
          {/* Viewer controls */}
          {viewerOnly && currentBroadcast && !isOwner && (
            <div className="flex flex-col gap-2 px-4 py-3 text-xs border rounded-md bg-slate-800/40 border-slate-700 text-slate-200">
              <div>
                البث المحدد:{" "}
                <strong className="text-emerald-300">
                  {currentBroadcast.title || `${labelForKind(currentBroadcast.kind)} رقم ${currentBroadcast.id}`}
                </strong>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void sendJoin("VIEW")}
                  disabled={!canSendJoin("VIEW")}
                  className="px-3 py-1 text-[11px] rounded bg-emerald-500 text-slate-950 disabled:opacity-40 focus:outline-none focus:ring focus:ring-emerald-500/30"
                >
                  طلب مشاهدة
                  {joinStateView === "pending" && " (قيد المراجعة)"}
                  {joinStateView === "approved" && " ✔"}
                  {joinStateView === "rejected" && " (مرفوض)"}
                </button>
                <button
                  onClick={() => void sendJoin("CONTROL")}
                  disabled={!canSendJoin("CONTROL")}
                  className="px-3 py-1 text-[11px] rounded bg-fuchsia-600 text-white disabled:opacity-40 focus:outline-none focus:ring focus:ring-fuchsia-500/30"
                >
                  طلب تحكم بالمركبة
                  {joinStateControl === "pending" && " (قيد المراجعة)"}
                  {joinStateControl === "approved" && " ✔"}
                  {joinStateControl === "rejected" && " (مرفوض)"}
                </button>
              </div>
            </div>
          )}

          {/* Owner/admin quick tools */}
          {canPublishNow && (
            <div className="flex flex-wrap items-center gap-2 p-3 text-[11px] border rounded-lg border-slate-800 bg-slate-900/40">
              {!media?.camera?.isOn ? (
                <button
                  onClick={() => void startCamera()}
                  className="px-3 py-1 rounded bg-emerald-500 text-slate-950 focus:outline-none focus:ring focus:ring-emerald-500/30"
                >
                  تشغيل الكاميرا بالصوت
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void media?.stopCamera?.()}
                    className="px-3 py-1 rounded bg-slate-800 text-slate-100 focus:outline-none focus:ring focus:ring-slate-600/40"
                  >
                    إيقاف الكاميرا
                  </button>
                  <button
                    onClick={() => void media?.camera?.toggleMic?.()}
                    className={`px-3 py-1 rounded ${
                      media?.camera?.micMuted ? "bg-amber-500 text-slate-900" : "bg-slate-700 text-slate-50"
                    } focus:outline-none focus:ring focus:ring-amber-500/30`}
                  >
                    {media?.camera?.micMuted ? "تشغيل الميكروفون" : "كتم الميكروفون"}
                  </button>
                </>
              )}

              <span className="w-px h-4 mx-1 bg-slate-700" aria-hidden="true" />

              <button
                onClick={() => void media?.startScreen?.()}
                className="px-3 py-1 text-white bg-indigo-500 rounded focus:outline-none focus:ring focus:ring-indigo-500/30"
              >
                مشاركة الشاشة
              </button>
              <button
                onClick={() => void media?.stopScreen?.()}
                className="px-3 py-1 rounded bg-slate-800 text-slate-100 focus:outline-none focus:ring focus:ring-slate-600/40"
              >
                إيقاف مشاركة الشاشة
              </button>
            </div>
          )}

          {/* Pending join requests (publisher/admin) */}
          {publisherRole && (
            <div className="p-3 text-[11px] border rounded-lg border-slate-800 bg-slate-900/30">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-200">طلبات الانضمام</h2>
                <span className="text-[10px] text-slate-500">{pending.length} طلب</span>
              </div>
              <div className="max-h-[40svh] overflow-auto pr-1 custom-scroll">
                {pending.length === 0 ? (
                  <p className="text-slate-500">لا توجد طلبات في الوقت الحالي.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {pending.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 border rounded-md bg-slate-950/40 border-slate-800"
                      >
                        <div className="min-w-0">
                          <div className="text-slate-100">المستخدم رقم {r.fromUserId}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {r.message || "لا توجد رسالة مرفقة."}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500">
                            النوع: {r.intent === "CONTROL" ? "طلب تحكم" : "طلب مشاهدة"}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => void approveJoin(r)}
                            className="px-2 py-1 rounded bg-emerald-500 text-slate-950 focus:outline-none focus:ring focus:ring-emerald-500/30"
                          >
                            موافقة
                          </button>
                          <button
                            onClick={() => void rejectJoin(r)}
                            className="px-2 py-1 text-white rounded bg-red-500/80 focus:outline-none focus:ring focus:ring-red-500/30"
                          >
                            رفض
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Active broadcasts list */}
          <div className="p-3 text-[11px] border rounded-lg border-slate-800 bg-slate-900/30">
            <h2 className="mb-2 text-sm font-semibold text-slate-200">البثوث النشطة</h2>
            <div className="max-h-[40svh] overflow-auto pr-1 custom-scroll">
              {broadcasts.length === 0 ? (
                <p className="text-slate-500">لا توجد بثوث مباشرة في الوقت الحالي.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {broadcasts.map((b) => {
                    const selected = b.id === currentBroadcast?.id;
                    return (
                      <li
                        key={b.id}
                        onClick={() => setSelectedId(b.id)}
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(b.id)}
                        className={`flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer transition outline-none
                          ${
                            selected
                              ? "bg-slate-900 border-emerald-500/40 ring-1 ring-emerald-500/30"
                              : "bg-slate-950/40 border-slate-800 hover:border-slate-600 focus:ring-1 focus:ring-slate-600/40"
                          }`}
                        aria-current={selected ? "true" : "false"}
                      >
                        <div className="min-w-0">
                          <div className="text-xs truncate text-slate-100">
                            {b.title || `${labelForKind(b.kind)} رقم ${b.id}`}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate">
                            المالك: {b.ownerName || b.ownerUserId || "غير محدد"}
                          </div>
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selected ? "bg-emerald-400" : "bg-emerald-400/40"
                          }`}
                          aria-hidden="true"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default BroadcastSources;
