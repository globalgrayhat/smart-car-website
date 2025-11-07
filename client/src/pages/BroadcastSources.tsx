// client/src/pages/BroadcastSources.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BroadcastSources
 *
 * مركز موحّد لإدارة البث المباشر:
 * - عرض جميع البثوث النشطة من /broadcast/public.
 * - تجربة مشاهدة واحدة مدمجة (فيديو رئيسي).
 * - المالك / الأدمن يقدر يبث مباشرة من نفس الواجهة.
 * - المشاهد يقدر يرسل طلب مشاهدة / تحكم ويتم التحديث آني عبر WebSocket.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  u && (typeof u.userId === "number"
    ? u.userId
    : typeof u.id === "number"
    ? u.id
    : null);

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

  // حالة اتصال ميديا (للتناسق مع باقي الصفحات)
  const mediaStatus: "connected" | "connecting" | "disconnected" =
    media?.connStatus ?? media?.status ?? "disconnected";

  // قائمة الـ remotes من MediaContext
  const remotes: any[] = Array.isArray(media?.remotes)
    ? media.remotes
    : [];

  // نختار أول فيديو كتيار رئيسي
  const videoRemotes = remotes.filter((r) => r.kind === "video");
  const primary = videoRemotes[0] || null;

  // بيانات /broadcast/public
  const [broadcasts, setBroadcasts] = useState<BroadcastSource[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // حالات طلبات الانضمام (للمستخدم الحالي)
  const [joinStateView, setJoinStateView] =
    useState<JoinState>("idle");
  const [joinStateControl, setJoinStateControl] =
    useState<JoinState>("idle");

  // طلبات معلّقة للمالك / الأدمن
  const [pending, setPending] = useState<JoinRequestItem[]>([]);

  // أخطاء عامة
  const [error, setError] = useState<string | null>(null);

  // حالة تشغيل كاميرا محلية (للمذيع)
  const [isStartingCam, setIsStartingCam] = useState(false);

  // انتظار ظهور تيار الفيديو بعد السماح بالمشاهدة
  const [waitingVideo, setWaitingVideo] = useState(false);

  // لمعاينة الكاميرا المحلية (لو احتجنا)
  const localPreviewRef =
    useRef<HTMLVideoElement | null>(null);

  /**
   * البث الحالي المختار
   */
  const currentBroadcast: BroadcastSource | null = useMemo(
    () =>
      selectedId != null
        ? broadcasts.find((b) => b.id === selectedId) || null
        : broadcasts[0] || null,
    [broadcasts, selectedId],
  );

  const currentOwnerId =
    currentBroadcast?.ownerUserId ?? null;

  const isOwner =
    !!userId &&
    !!currentOwnerId &&
    Number(userId) === Number(currentOwnerId);

  // من يقدر يشوف بدون إذن؟
  const canAlwaysView =
    !!userId && (publisherRole || isOwner);

  // السماح الفعلي بالمشاهدة
  const allowView =
    canAlwaysView || joinStateView === "approved";

  // من يقدر يتحكم / يبث فعلياً؟
  const canPublishNow =
    canAlwaysView || joinStateControl === "approved";

  /**
   * تحميل قائمة البثوث النشطة
   */
  const loadBroadcasts = useCallback(async () => {
    try {
      const res = await api.get("/broadcast/public");
      const list: any[] = Array.isArray(res) ? res : [];

      const clean: BroadcastSource[] = list
        .filter(
          (x) =>
            x &&
            x.onAir &&
            String(x.kind || "").toUpperCase() !== "AUDIO",
        )
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
      if (!selectedId && clean[0]) {
        setSelectedId(clean[0].id);
      }
      setError(null);
    } catch (e: any) {
      setBroadcasts([]);
      setError(e?.message || "تعذّر تحميل قائمة البثوث.");
    }
  }, [selectedId]);

  /**
   * تحميل طلبات الانضمام الموجهة لي (للمذيع/الأدمن)
   */
  const loadMyPending = useCallback(async () => {
    if (!publisherRole) return;
    try {
      const res = await api.get("/join-requests/my");
      const list: any[] = Array.isArray(res) ? res : [];
      setPending(
        list.filter(
          (r) =>
            r &&
            r.status === "PENDING" &&
            r.intent &&
            r.id,
        ),
      );
    } catch {
      setPending([]);
    }
  }, [publisherRole]);

  /**
   * تحميل آخر حالة طلب بين المستخدم الحالي ومالك البث
   */
  const loadLastJoin = useCallback(
    async (ownerId?: number | null) => {
      if (!ownerId || !userId) return;
      if (Number(ownerId) === Number(userId)) return;

      try {
        const res: any = await api.get(
          `/join-requests/last/${ownerId}`,
        );

        if (!res || res.status === "NONE") {
          setJoinStateView("idle");
          setJoinStateControl("idle");
          return;
        }

        const st: JoinState =
          res.status === "APPROVED"
            ? "approved"
            : res.status === "REJECTED"
            ? "rejected"
            : "pending";

        if (res.intent === "VIEW") {
          setJoinStateView(st);
        }
        if (res.intent === "CONTROL") {
          setJoinStateControl(st);
        }
      } catch {
        // نتجاهل خطأ الاستعلام هنا
      }
    },
    [userId],
  );

  /**
   * تحميل مبدئي
   */
  useEffect(() => {
    void loadBroadcasts();
    void loadMyPending();
  }, [loadBroadcasts, loadMyPending]);

  /**
   * تحديث دوري خفيف للناشر/الأدمن لمزامنة القائمة والطلبات
   */
  useEffect(() => {
    if (!publisherRole) return;
    const id = setInterval(() => {
      void loadBroadcasts();
      void loadMyPending();
    }, 5000);
    return () => clearInterval(id);
  }, [publisherRole, loadBroadcasts, loadMyPending]);

  /**
   * عند تغيير البث الحالي، نحدّث حالة الطلبات بيني وبينه
   */
  useEffect(() => {
    if (!currentBroadcast) return;
    void loadLastJoin(currentBroadcast.ownerUserId);
  }, [
    currentBroadcast?.id,
    currentBroadcast?.ownerUserId,
    loadLastJoin,
  ]);

  /**
   * استقبال تحديثات حالة الطلبات عبر WebSocket
   */
  useEffect(() => {
    if (!socket || !userId) return;

    const handler = (p: {
      toUserId: number;
      status: "APPROVED" | "REJECTED";
      intent: Intent;
    }) => {
      if (Number(p.toUserId) !== Number(userId)) return;

      const st: JoinState =
        p.status === "APPROVED"
          ? "approved"
          : "rejected";

      if (p.intent === "VIEW") {
        setJoinStateView(st);
        if (p.status === "APPROVED") {
          media?.setViewingAllowed?.(true);
          media?.refreshProducers?.();
        }
      }

      if (p.intent === "CONTROL") {
        setJoinStateControl(st);
      }
    };

    socket.on("join-requests:status", handler);
    return () => {
      socket.off("join-requests:status", handler);
    };
  }, [socket, userId, media]);

  /**
   * هل يمكن إرسال طلب (VIEW أو CONTROL) للبث الحالي؟
   */
  const canSendJoin = (intent: Intent): boolean => {
    if (!currentBroadcast || !currentBroadcast.ownerUserId || !userId)
      return false;

    if (
      Number(userId) ===
      Number(currentBroadcast.ownerUserId)
    )
      return false;

    const state =
      intent === "VIEW"
        ? joinStateView
        : joinStateControl;

    return state === "idle" || state === "rejected";
  };

  /**
   * إرسال طلب انضمام للبث الحالي
   */
  const sendJoin = async (intent: Intent) => {
    if (
      !currentBroadcast ||
      !currentBroadcast.ownerUserId ||
      !userId
    )
      return;
    if (!canSendJoin(intent)) return;

    const setState =
      intent === "VIEW"
        ? setJoinStateView
        : setJoinStateControl;

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
      setError(
        "تعذّر إرسال الطلب. يرجى المحاولة لاحقًا.",
      );
    }
  };

  /**
   * اعتماد / رفض طلبات الانضمام (للمالك / الأدمن)
   */
  const approveJoin = async (req: JoinRequestItem) => {
    try {
      await api.post(
        `/join-requests/${req.id}/approve`,
      );
      setPending((prev) =>
        prev.filter((r) => r.id !== req.id),
      );
      socket?.emit?.("join:notify", {
        toUserId: req.fromUserId,
        status: "APPROVED",
        intent: req.intent,
        requestId: req.id,
      });
    } catch {
      setError(
        "تعذّر اعتماد الطلب. يرجى المحاولة لاحقًا.",
      );
    }
  };

  const rejectJoin = async (req: JoinRequestItem) => {
    try {
      await api.post(
        `/join-requests/${req.id}/reject`,
      );
      setPending((prev) =>
        prev.filter((r) => r.id !== req.id),
      );
      socket?.emit?.("join:notify", {
        toUserId: req.fromUserId,
        status: "REJECTED",
        intent: req.intent,
        requestId: req.id,
      });
    } catch {
      setError(
        "تعذّر رفض الطلب. يرجى المحاولة لاحقًا.",
      );
    }
  };

  /**
   * تشغيل كاميرا المالك محلياً (للبث من نفس الواجهة)
   */
  const startCamera = async () => {
    if (!canPublishNow) return;
    setIsStartingCam(true);
    try {
      await media?.startCamera?.({
        withAudio: true,
      });
    } finally {
      setTimeout(
        () => setIsStartingCam(false),
        300,
      );
    }
  };

  /**
   * ربط معاينة الكاميرا المحلية إذا متاحة
   */
  useEffect(() => {
    if (!localPreviewRef.current) return;

    const stream =
      media?.localCameraStream ||
      media?.localStream ||
      media?.previewStream ||
      media?.cameraStream;

    if (stream && localPreviewRef.current.srcObject !== stream) {
      localPreviewRef.current.srcObject = stream;
    }
  }, [media]);

  /**
   * نشر صلاحية المشاهدة للـ MediaContext
   */
  useEffect(() => {
    media?.setViewingAllowed?.(!!allowView);
    if (
      allowView &&
      mediaStatus === "connected"
    ) {
      media?.refreshProducers?.();
    }
  }, [allowView, mediaStatus, media]);

  /**
   * إدارة حالة الانتظار لظهور منتِج الفيديو
   */
  useEffect(() => {
    if (
      !currentBroadcast ||
      !allowView ||
      mediaStatus !== "connected"
    ) {
      setWaitingVideo(false);
      return;
    }

    if (videoRemotes.length > 0) {
      setWaitingVideo(false);
      return;
    }

    setWaitingVideo(true);
    media?.refreshProducers?.();
  }, [
    currentBroadcast?.id,
    allowView,
    mediaStatus,
    videoRemotes.length,
    media,
  ]);

  /**
   * منطق عرض منطقة البث الرئيسية
   */
  const renderMain = () => {
    // مشاهد بدون إذن مشاهدة
    if (viewerOnly && !allowView) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
          <p className="px-3 py-1 text-sm rounded bg-slate-950/80 text-slate-100">
            هذا البث خاص. يرجى إرسال طلب مشاهدة للحصول على الإذن.
          </p>
          <p className="text-[11px] text-slate-500">
            اختر البث من القائمة على اليمين ثم اضغط "طلب مشاهدة".
          </p>
        </div>
      );
    }

    // اتصال / تهيئة
    if (mediaStatus === "connecting" || isStartingCam) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full gap-3">
          <div className="w-10 h-10 border-2 rounded-full border-t-emerald-400 border-slate-600/40 animate-spin" />
          <p className="text-xs text-slate-300">
            جارٍ تهيئة الاتصال بنظام البث المباشر…
          </p>
        </div>
      );
    }

    // تيار رئيسي جاهز + مسموح مشاهدة
    if (primary && allowView) {
      const activeId =
        primary.producerId ||
        primary.id ||
        primary.streamId;

      return (
        <LiveTile
          producerId={String(activeId)}
          kind="video"
          isPrimary
          zoomable
          title={
            currentBroadcast?.title ||
            labelForKind(currentBroadcast?.kind)
          }
          peerId={primary.peerId}
        />
      );
    }

    // ننتظر ظهور الفيديو بعد اختيار البث ووجود إذن
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

    // معاينة محلية للمالك (لو يشغّل كاميرته من هنا)
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

    // لا يوجد شيء متاح
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-2 px-6 text-center">
        <p className="px-3 py-1 text-sm rounded bg-slate-950/70 text-slate-100">
          لا يوجد تيار متاح للعرض حاليًا.
        </p>
        <p className="text-[11px] text-slate-500">
          تأكد من وجود بث مباشر فعّال أو تشغيل كاميرا مالك البث.
        </p>
      </div>
    );
  };

  /**
   * الواجهة الرئيسية
   */
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* عنوان الصفحة */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-white">
          مركز البث المباشر
        </h1>
        <p className="text-sm text-slate-400">
          تجربة موحّدة لمتابعة البثوث النشطة، إدارة صلاحيات المشاهدة والتحكم،
          وتشغيل كاميرا المضيف من نفس الواجهة.
        </p>
      </header>

      {/* حالة الاتصال بخادم البث */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-[11px] border ${
          mediaStatus === "connected"
            ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/40"
            : mediaStatus === "connecting"
            ? "bg-amber-500/10 text-amber-100 border-amber-500/40"
            : "bg-red-500/10 text-red-200 border-red-500/40"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            mediaStatus === "connected"
              ? "bg-emerald-400"
              : mediaStatus === "connecting"
              ? "bg-amber-400"
              : "bg-red-400"
          }`}
        />
        {mediaStatus === "connected"
          ? "متصل بخادم البث."
          : mediaStatus === "connecting"
          ? "جارٍ الاتصال بخادم البث…"
          : "غير متصل بخادم البث."}
      </div>

      {/* رسالة خطأ عامة */}
      {error && (
        <div className="px-4 py-2 text-xs border rounded-md bg-red-500/10 border-red-500/30 text-red-50">
          {error}
        </div>
      )}

      {/* تخطيط رئيسي: معاينة + لوحة جانبية */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* منطقة البث الرئيسية */}
        <section className="space-y-4 lg:col-span-8">
        <div
          className="
            relative w-full overflow-hidden border rounded-lg
            bg-slate-950/40 border-slate-800
            min-h-[180px] max-h-[65vh]
            md:min-h-[240px] md:max-h-[75vh]
          "
        >
          {renderMain()}
        </div>
        </section>

        {/* اللوحة الجانبية */}
        <aside className="space-y-4 lg:col-span-4">
          {/* للمشاهد: طلب مشاهدة / تحكم للبث المحدد */}
          {viewerOnly &&
            currentBroadcast &&
            !isOwner && (
              <div className="flex flex-col gap-2 px-4 py-3 text-xs border rounded-md bg-slate-800/40 border-slate-700 text-slate-200">
                <div>
                  البث المحدد:{" "}
                  <strong className="text-emerald-300">
                    {currentBroadcast.title ||
                      `${labelForKind(
                        currentBroadcast.kind,
                      )} رقم ${currentBroadcast.id}`}
                  </strong>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void sendJoin("VIEW")}
                    disabled={!canSendJoin("VIEW")}
                    className="px-3 py-1 text-[11px] rounded bg-emerald-500 text-slate-950 disabled:opacity-40"
                  >
                    طلب مشاهدة
                    {joinStateView === "pending" &&
                      " (قيد المراجعة)"}
                    {joinStateView === "approved" &&
                      " ✔"}
                    {joinStateView === "rejected" &&
                      " (مرفوض)"}
                  </button>
                  <button
                    onClick={() =>
                      void sendJoin("CONTROL")
                    }
                    disabled={!canSendJoin("CONTROL")}
                    className="px-3 py-1 text-[11px] rounded bg-fuchsia-600 text-white disabled:opacity-40"
                  >
                    طلب تحكم بالمركبة
                    {joinStateControl === "pending" &&
                      " (قيد المراجعة)"}
                    {joinStateControl === "approved" &&
                      " ✔"}
                    {joinStateControl === "rejected" &&
                      " (مرفوض)"}
                  </button>
                </div>
              </div>
            )}

          {/* للمالك / الأدمن (أو من عنده صلاحية تحكم): أدوات سريعة للبث */}
          {canPublishNow && (
            <div className="flex flex-wrap items-center gap-2 p-3 text-[11px] border rounded-lg border-slate-800 bg-slate-900/40">
              {!media?.camera?.isOn ? (
                <button
                  onClick={() => void startCamera()}
                  className="px-3 py-1 rounded bg-emerald-500 text-slate-950"
                >
                  تشغيل الكاميرا بالصوت
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      void media?.stopCamera?.()
                    }
                    className="px-3 py-1 rounded bg-slate-800 text-slate-100"
                  >
                    إيقاف الكاميرا
                  </button>
                  <button
                    onClick={() =>
                      void media?.camera?.toggleMic?.()
                    }
                    className={`px-3 py-1 rounded ${
                      media?.camera?.micMuted
                        ? "bg-amber-500 text-slate-900"
                        : "bg-slate-700 text-slate-50"
                    }`}
                  >
                    {media?.camera?.micMuted
                      ? "تشغيل الميكروفون"
                      : "كتم الميكروفون"}
                  </button>
                </>
              )}

              <span className="w-px h-4 mx-1 bg-slate-700" />

              <button
                onClick={() =>
                  void media?.startScreen?.()
                }
                className="px-3 py-1 text-white bg-indigo-500 rounded"
              >
                مشاركة الشاشة
              </button>
              <button
                onClick={() =>
                  void media?.stopScreen?.()
                }
                className="px-3 py-1 rounded bg-slate-800 text-slate-100"
              >
                إيقاف مشاركة الشاشة
              </button>
            </div>
          )}

          {/* طلبات الانضمام (للناشر / الأدمن) */}
          {publisherRole && (
            <div className="p-3 text-[11px] border rounded-lg border-slate-800 bg-slate-900/30">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-200">
                  طلبات الانضمام
                </h2>
                <span className="text-[10px] text-slate-500">
                  {pending.length} طلب
                </span>
              </div>
              {pending.length === 0 ? (
                <p className="text-slate-500">
                  لا توجد طلبات في الوقت الحالي.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pending.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 border rounded-md bg-slate-950/40 border-slate-800"
                    >
                      <div>
                        <div className="text-slate-100">
                          المستخدم رقم {r.fromUserId}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {r.message ||
                            "لا توجد رسالة مرفقة."}
                        </div>
                        <div className="mt-1 text-[9px] text-slate-500">
                          النوع:{" "}
                          {r.intent === "CONTROL"
                            ? "طلب تحكم"
                            : "طلب مشاهدة"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            void approveJoin(r)
                          }
                          className="px-2 py-1 rounded bg-emerald-500 text-slate-950"
                        >
                          موافقة
                        </button>
                        <button
                          onClick={() =>
                            void rejectJoin(r)
                          }
                          className="px-2 py-1 text-white rounded bg-red-500/80"
                        >
                          رفض
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* قائمة البثوث النشطة */}
          <div className="p-3 text-[11px] border rounded-lg border-slate-800 bg-slate-900/30">
            <h2 className="mb-2 text-sm font-semibold text-slate-200">
              البثوث النشطة
            </h2>
            {broadcasts.length === 0 ? (
              <p className="text-slate-500">
                لا توجد بثوث مباشرة في الوقت الحالي.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {broadcasts.map((b) => {
                  const selected =
                    b.id === currentBroadcast?.id;
                  return (
                    <li
                      key={b.id}
                      onClick={() =>
                        setSelectedId(b.id)
                      }
                      className={`flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer transition ${
                        selected
                          ? "bg-slate-900 border-emerald-500/40"
                          : "bg-slate-950/40 border-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <div>
                        <div className="text-xs text-slate-100">
                          {b.title ||
                            `${labelForKind(
                              b.kind,
                            )} رقم ${b.id}`}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          المالك:{" "}
                          {b.ownerName ||
                            b.ownerUserId ||
                            "غير محدد"}
                        </div>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          selected
                            ? "bg-emerald-400"
                            : "bg-emerald-400/40"
                        }`}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default BroadcastSources;
