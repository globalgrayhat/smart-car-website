/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MediaContext
 * - Socket + mediasoup device/transport management
 * - View gating: do not consume/attach when not approved
 * - Simulcast on camera video (3 layers): ~144p / ~360p / ~720p+
 * - Quality control for viewers via Consumer.setPreferredLayers
 * - Stable stream ids across on/off within same browser (localStorage)
 * - End broadcast helper for host/admin
 * - Car command queue (friendly throttling)
 *
 * UX policies:
 * - Only one PRIMARY video tile. Audio is paired invisibly (no separate audio tile).
 * - Viewers cannot create SEND transports; buttons hidden and also guarded on backend.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";

const WS_BASE =
  (import.meta.env.VITE_WS_BASE_URL && import.meta.env.VITE_WS_BASE_URL.replace(/\/+$/, "")) ||
  (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")) ||
  "http://localhost:3000";

const WS_NS = "/mediasoup";
const FALLBACK_CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || "global";

type ConnState = "connecting" | "connected" | "disconnected";

type MediaCtx = {
  socket: Socket | null;
  connStatus: ConnState;
  status: ConnState;
  lastDisconnect: number | null;
  channelId: string;
  streams: any[];
  remotes: Array<{ id: string; producerId: string; kind: "video" | "audio"; label?: string; peerId?: string }>;
  devices: { audioInputs?: any[]; videoInputs?: any[] } | null;

  /** Gate whether the user is allowed to view (attach/consume) */
  setViewingAllowed: (allowed: boolean) => void;

  /** Viewer quality control: "auto" (null) or 0=~144p, 1=~360p, 2=~720p+ */
  setPreferredQuality: (layer: 0 | 1 | 2 | null) => void;

  camera: {
    isOn: boolean;
    micMuted: boolean;
    bindVideo: (el: HTMLVideoElement | null) => void;
    start: (opts?: { withAudio?: boolean; audioDeviceId?: string }) => Promise<void>;
    stop: () => void;
    toggleMic: () => void;
    capture?: () => void;
  } | null;

  screen: {
    isSharing: boolean;
    isBroadcasting: boolean;
    isRecording: boolean;
    recordUrl: string | null;
    streamId: string | null;
    bindVideo: (el: HTMLVideoElement | null) => void;
    start: (opts?: any) => Promise<void>;
    stop: () => void;
    startBroadcast: () => void;
    stopBroadcast: () => void;
    capture: () => void;
    startRecording: () => void;
    stopRecording: () => void;
  } | null;

  incomingCameraRequests: any[];
  clearCameraRequest: (idx: number) => void;
  incomingJoinRequests: any[];
  clearJoinRequest: (idx: number) => void;

  // Convenience aliases used elsewhere
  startCamera?: (opts?: any) => void;
  stopCamera?: () => void;
  startScreen?: (opts?: any) => void;
  stopScreen?: () => void;

  /** Bind remote producer to a media element */
  bindRemote?: (producerId: string, el: HTMLVideoElement | HTMLAudioElement | null) => void;
  /** Bind remote AUDIO by peerId and attach to hidden audio tag */
  bindPeerAudio?: (peerId: string, el: HTMLAudioElement | null) => void;

  localCameraStream?: MediaStream | null;
  localScreenStream?: MediaStream | null;

  refreshProducers?: () => Promise<void>;

  /** End broadcast (host/admin convenience) */
  endBroadcast?: () => void;

  /** Send car command with queue-friendly throttling */
  sendCarCommand?: (action: string, value?: unknown) => void;
};

const MediaContext = createContext<MediaCtx | undefined>(undefined);

// ---------------- Safe play/attach helpers ----------------

const safePlay = async (el: HTMLMediaElement | null | undefined, label = ""): Promise<void> => {
  if (!el) return;
  try {
    const p = el.play();
    if (p && typeof p.then === "function") await p;
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.name === "NotAllowedError" || err?.name === "NotSupportedError") {
      console.debug("[safePlay]", label, "ignored:", err?.name);
    } else {
      console.warn("[safePlay]", label, err);
    }
  }
};

const attachStream = async (el: HTMLMediaElement | null | undefined, stream: MediaStream | null | undefined, label = ""): Promise<void> => {
  if (!el) return;
  if (!stream) {
    if (el.srcObject) el.srcObject = null;
    return;
  }
  if (el.srcObject !== stream) el.srcObject = stream;
  await safePlay(el, label);
};

// --------------- utils ---------------

const getStableId = (key: string, fallback: string) => {
  const LS = `stable:${key}`;
  const old = localStorage.getItem(LS);
  if (old) return old;
  localStorage.setItem(LS, fallback);
  return fallback;
};

export const MediaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Socket state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<ConnState>("disconnected");
  const [lastDisconnect, setLastDisconnect] = useState<number | null>(null);

  // UI lists
  const [streams, setStreams] = useState<any[]>([]);
  const [remotes, setRemotes] = useState<Array<{ id: string; producerId: string; kind: "video" | "audio"; label?: string; peerId?: string }>>([]);
  const [devices, setDevices] = useState<{ audioInputs?: any[]; videoInputs?: any[] } | null>(null);

  const [incomingCameraRequests, setIncomingCameraRequests] = useState<any[]>([]);
  const [incomingJoinRequests, setIncomingJoinRequests] = useState<any[]>([]);

  const [channelId, setChannelId] = useState(FALLBACK_CHANNEL_ID);

  // View gating & quality
  const [viewAllowed, setViewAllowed] = useState<boolean>(true);
  const [preferredLayer, setPreferredLayer] = useState<0 | 1 | 2 | null>(null);

  // Local camera
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camId, setCamId] = useState<string | null>(null); // stable id (per browser)

  // Local screen
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<Blob[]>([]);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenBroadcasting, setScreenBroadcasting] = useState(false);
  const [screenRecording, setScreenRecording] = useState(false);
  const [screenRecordUrl, setScreenRecordUrl] = useState<string | null>(null);
  const [screenId, setScreenId] = useState<string | null>(null);

  // Mediasoup internals
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const recvTransportRef = useRef<any>(null);
  const sendTransportRef = useRef<any>(null);
  const consumersRef = useRef<
    Map<string, { consumer: any; stream: MediaStream; kind: "video" | "audio"; peerId?: string }>
  >(new Map());
  const remoteElementsRef = useRef<Map<string, HTMLVideoElement | HTMLAudioElement | null>>(new Map());
  const remotePeerAudioRef = useRef<Map<string, { el?: HTMLAudioElement | null; stream?: MediaStream }>>(new Map());

  const camVideoProducerRef = useRef<any>(null);
  const camAudioProducerRef = useRef<any>(null);
  const screenVideoProducerRef = useRef<any>(null);

  // Car command queue
  const cmdQueueRef = useRef<any[]>([]);
  const cmdBusyRef = useRef(false);

  // ------------- socket helpers & mini-promises -------------

  const makeWaitForEventOn = useCallback(
    (s: Socket) =>
      <T,>(event: string, filter?: (payload: any) => boolean, timeoutMs = 8000): Promise<T> =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            s.off(event, handler);
            reject(new Error(`Timeout waiting for ${event}`));
          }, timeoutMs);
          const handler = (payload: any) => {
            if (filter && !filter(payload)) return;
            clearTimeout(timer);
            s.off(event, handler);
            resolve(payload as T);
          };
          s.on(event, handler);
        }),
    [],
  );

  // ----------------------- consumer helper -----------------------
  const makeConsumeRemoteProducer = useCallback(
    (s: Socket, waitForEventOn: ReturnType<typeof makeWaitForEventOn>) =>
      async (producerId: string) => {
        if (!viewAllowed) return; // Gate consumption until approved
        if (consumersRef.current.has(producerId)) return;

        const device = deviceRef.current;
        const recvTransport = recvTransportRef.current;
        if (!device || !recvTransport) return; // not ready

        s.emit("consume", {
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        const consumed = await waitForEventOn<any>("consumed", (p) => p.producerId === producerId);

        const consumer = await recvTransport.consume({
          id: consumed.id,
          producerId,
          kind: consumed.kind,
          rtpParameters: consumed.rtpParameters,
        });

        const stream = new MediaStream();
        stream.addTrack(consumer.track);

        // Apply preferred layer for video consumers (simulcast/SVC)
        if (consumed.kind === "video" && preferredLayer !== null && typeof consumer.setPreferredLayers === "function") {
          try {
            await consumer.setPreferredLayers({ spatialLayer: preferredLayer });
          } catch {
            /* ignore if codec doesn't support layers */
          }
        }

        consumersRef.current.set(producerId, {
          consumer,
          stream,
          kind: consumed.kind,
          peerId: consumed.peerId,
        });

        // Attach to registered element (if any)
        const el = remoteElementsRef.current.get(producerId);
        if (el) await attachStream(el, stream, `remote:${producerId}`);

        // Maintain remotes list for UI
        setRemotes((prev) => {
          const exists = prev.some((r) => r.id === producerId || r.producerId === producerId);
          const entry = {
            id: producerId,
            producerId,
            kind: consumed.kind as "video" | "audio",
            label: `REMOTE • ${producerId.slice(0, 6)}`,
            peerId: consumed.peerId as string | undefined,
          };
          return exists ? prev.map((r) => (r.id === producerId || r.producerId === producerId ? { ...r, ...entry } : r)) : [...prev, entry];
        });

        // Pair audio by peer for primary video
        if (consumed.kind === "audio" && consumed.peerId) {
          const rec = remotePeerAudioRef.current.get(consumed.peerId) || {};
          rec.stream = stream;
          remotePeerAudioRef.current.set(consumed.peerId, rec);
          if (rec.el) await attachStream(rec.el, stream, `peerAudio:${consumed.peerId}`);
        }
      },
    [makeWaitForEventOn, viewAllowed, preferredLayer],
  );

  // ----------------------- mediasoup init -----------------------
  const initMediasoupOn = useCallback(
    async (s: Socket) => {
      const waitForEventOn = makeWaitForEventOn(s);
      const consumeRemoteProducer = makeConsumeRemoteProducer(s, waitForEventOn);

      try {
        // Device
        s.emit("getRouterRtpCapabilities");
        const routerCaps = await waitForEventOn<any>("routerRtpCapabilities");

        const device = new mediasoupClient.Device();
        await device.load({ routerRtpCapabilities: routerCaps });
        deviceRef.current = device;

        // Recv transport
        s.emit("createWebRtcTransport", { direction: "recv" });
        const recvInfo = await waitForEventOn<any>("transportCreated");

        const recvTransport = device.createRecvTransport(recvInfo);
        recvTransport.on("connect", ({ dtlsParameters }: any, cb: any) => {
          s.emit("connectWebRtcTransport", { transportId: recvInfo.id, dtlsParameters });
          cb();
        });
        recvTransportRef.current = recvTransport;

        // Initial producers (if viewing allowed)
        if (viewAllowed) {
          s.emit("listProducers");
          const list = await waitForEventOn<any>("producers");
          if (Array.isArray(list)) {
            for (const pid of list) {
              // eslint-disable-next-line no-await-in-loop
              await consumeRemoteProducer(String(pid));
            }
          }
        }

        // Subscribe to new producers
        s.on("newProducer", async ({ producerId }: { producerId: string }) => {
          if (!viewAllowed) return;
          await consumeRemoteProducer(producerId);
        });

        // Expose refresh hook for UI
        const doRefresh = async () => {
          s.emit("listProducers");
          try {
            const lst = await waitForEventOn<any>("producers", undefined, 3000);
            if (Array.isArray(lst)) {
              for (const pid of lst) {
                // eslint-disable-next-line no-await-in-loop
                await consumeRemoteProducer(String(pid));
              }
            }
          } catch {
            /* ignore timeouts */
          }
        };
        (s as any).__refreshProducers = doRefresh;
      } catch (err) {
        console.warn("[MediaContext] mediasoup init failed:", err);
      }
    },
    [makeWaitForEventOn, makeConsumeRemoteProducer, viewAllowed],
  );

  // ----------------------- connect socket -----------------------
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("access_token") || "";

    const s = io(`${WS_BASE}${WS_NS}`, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 8000,
      auth: token ? { token } : undefined,
    });

    setSocket(s);
    setConnStatus("connecting");

    s.on("connect", () => setConnStatus("connected"));

    s.on("ready", (payload: { channelId: string; role: string }) => {
      setChannelId(payload.channelId || FALLBACK_CHANNEL_ID);
      void initMediasoupOn(s);
    });

    s.on("streams:list", (list: any[]) => setStreams(Array.isArray(list) ? list : []));
    s.on("devices:list", (list: any) => setDevices(list || null));
    s.on("camera:attach-request", (payload: any) =>
      setIncomingCameraRequests((prev) => [...prev, payload]),
    );
    s.on("join-broadcast:incoming", (payload: any) =>
      setIncomingJoinRequests((prev) => [...prev, payload]),
    );

    s.on("disconnect", () => {
      setConnStatus("disconnected");
      setLastDisconnect(Date.now());

      // Cleanup mediasoup stuff
      deviceRef.current = null;
      recvTransportRef.current = null;
      sendTransportRef.current = null;
      consumersRef.current.forEach(({ consumer }) => {
        try {
          consumer.close();
        } catch {}
      });
      consumersRef.current.clear();
      remoteElementsRef.current.clear();
      remotePeerAudioRef.current.clear();
      setRemotes([]);
    });

    return () => {
      s.disconnect();
      setConnStatus("disconnected");
    };
  }, [initMediasoupOn]);

  // Pause/close consumers if view is revoked, and refresh when allowed
  useEffect(() => {
    if (!socket) return;
    if (!viewAllowed) {
      // Close all consumers and clear remotes to ensure no AV leaks
      consumersRef.current.forEach(({ consumer }) => {
        try {
          consumer.close();
        } catch {}
      });
      consumersRef.current.clear();
      remoteElementsRef.current.clear();
      remotePeerAudioRef.current.clear();
      setRemotes([]);
    } else {
      // Re-query producers when allowed again
      const s = socket as any;
      if (typeof s.__refreshProducers === "function") void s.__refreshProducers();
    }
  }, [viewAllowed, socket]);

  // ----------------------- expose binding -----------------------
  const bindRemote = useCallback(
    async (producerId: string, el: HTMLVideoElement | HTMLAudioElement | null) => {
      remoteElementsRef.current.set(producerId, el);
      const rec = consumersRef.current.get(producerId);
      if (rec && el) {
        await attachStream(el, rec.stream, `bindRemote:${producerId}`);
        return;
      }
      const s = socket as any;
      if (s && typeof s.__refreshProducers === "function" && viewAllowed) {
        await s.__refreshProducers();
      }
    },
    [socket, viewAllowed],
  );

  const bindPeerAudio = useCallback(async (peerId: string, el: HTMLAudioElement | null) => {
    const rec = remotePeerAudioRef.current.get(peerId) || {};
    rec.el = el;
    remotePeerAudioRef.current.set(peerId, rec);
    if (rec.stream && el) await attachStream(el, rec.stream, `peerAudio:${peerId}`);
  }, []);

  // ----------------------- send transport (publishers only) -----------------------
  const getSendTransport = useCallback(async () => {
    if (sendTransportRef.current) return sendTransportRef.current;
    if (!socket || !deviceRef.current) return null;

    const waitForEventOn = makeWaitForEventOn(socket);

    // If backend refuses, we just won't get "transportCreated"
    socket.emit("createWebRtcTransport", { direction: "send" });
    let sendInfo: any;
    try {
      sendInfo = await waitForEventOn<any>("transportCreated");
    } catch (err) {
      console.warn("[MediaContext] send transport denied or failed:", err);
      return null;
    }

    const transport = deviceRef.current.createSendTransport(sendInfo);

    transport.on("connect", ({ dtlsParameters }: any, cb: any) => {
      socket.emit("connectWebRtcTransport", {
        transportId: sendInfo.id,
        dtlsParameters,
      });
      cb();
    });

    transport.on("produce", (params: any, cb: (arg: { id: string }) => void, errCb: (err: any) => void) => {
      socket.emit("produce", {
        transportId: sendInfo.id,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
        appData: params.appData,
      });
      waitForEventOn<any>("produced", (p) => p && p.producerId)
        .then((p) => cb({ id: p.producerId }))
        .catch((err) => errCb(err));
    });

    sendTransportRef.current = transport;
    return transport;
  }, [socket, makeWaitForEventOn]);

  // ----------------------- CAMERA (Simulcast) -----------------------
  const cameraBindVideo = useCallback((el: HTMLVideoElement | null) => {
    cameraVideoRef.current = el;
    if (el && cameraStreamRef.current) void attachStream(el, cameraStreamRef.current, "local-camera");
  }, []);

  const cameraStart = useCallback(
    async (opts?: { withAudio?: boolean; audioDeviceId?: string }) => {
      // Request 720p@30 as base; simulcast layers scale down to ~360p and ~144p
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: opts?.withAudio
          ? (opts.audioDeviceId ? { deviceId: { exact: opts.audioDeviceId } } : true)
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      setCameraOn(true);
      setMicMuted(false);

      if (cameraVideoRef.current) {
        void attachStream(cameraVideoRef.current, stream, "local-camera");
      }

      const transport = await getSendTransport();
      if (transport) {
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) {
          // 3-layer simulcast: q (low ~144p), h (~360p), f (~720p)
          const encodings = [
            { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000 },
            { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 600_000 },
            { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_500_000 },
          ];
          const p = await transport.produce({
            track: vTrack,
            encodings,
            appData: { mediaTag: "camera-video" },
          });
          camVideoProducerRef.current = p;
        }
        if (opts?.withAudio) {
          const aTrack = stream.getAudioTracks()[0];
          if (aTrack) {
            const p = await transport.produce({
              track: aTrack,
              appData: { mediaTag: "camera-audio" },
            });
            camAudioProducerRef.current = p;
          }
        }
      }

      if (socket) {
        const fallback = `cam-s-${socket.id}`;
        const stable = getStableId("camera", fallback);
        socket.emit("stream:start", { channelId, kind: "camera", streamId: stable });
        setCamId(stable);
      }
    },
    [channelId, getSendTransport, socket],
  );

  const cameraStop = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraOn(false);

    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;

    try { camVideoProducerRef.current?.close?.(); } catch {}
    try { camAudioProducerRef.current?.close?.(); } catch {}
    camVideoProducerRef.current = null;
    camAudioProducerRef.current = null;
    setMicMuted(false);

    if (socket && camId) {
      socket.emit("stream:stop", { channelId, streamId: camId });
    } else if (socket) {
      socket.emit("stream:stop", { channelId, kind: "camera" });
    }
    setCamId(null);
  }, [channelId, socket, camId]);

  const cameraToggleMic = useCallback(() => {
    const p = camAudioProducerRef.current;
    if (p && typeof p.pause === "function" && typeof p.resume === "function") {
      if (micMuted) { try { p.resume(); setMicMuted(false); } catch {} }
      else { try { p.pause(); setMicMuted(true); } catch {} }
      return;
    }
    const aTrack = cameraStreamRef.current?.getAudioTracks?.()[0];
    if (aTrack) {
      aTrack.enabled = !aTrack.enabled;
      setMicMuted(!aTrack.enabled);
    }
  }, [micMuted]);

  const cameraCapture = useCallback(() => {
    const video = cameraVideoRef.current;
    if (!video || !video.srcObject) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `camera-${Date.now()}.png`;
    a.click();
  }, []);

  // ----------------------- SCREEN -----------------------
  const screenBindVideo = useCallback((el: HTMLVideoElement | null) => {
    screenVideoRef.current = el;
    if (el && screenStreamRef.current) void attachStream(el, screenStreamRef.current, "local-screen");
  }, []);

  const screenStart = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    screenStreamRef.current = stream;
    setScreenSharing(true);

    if (screenVideoRef.current) {
      void attachStream(screenVideoRef.current, stream, "local-screen");
    }

    const transport = await getSendTransport();
    if (transport) {
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        const encodings = [
          { rid: "q", scaleResolutionDownBy: 2.5, maxBitrate: 300_000 },
          { rid: "f", scaleResolutionDownBy: 1, maxBitrate: 1_200_000 },
        ];
        const p = await transport.produce({
          track: vTrack,
          encodings,
          appData: { mediaTag: "screen-video" },
        });
        screenVideoProducerRef.current = p;
      }
    }

    if (socket) {
      const fallback = `screen-s-${socket.id}`;
      const stable = getStableId("screen", fallback);
      setScreenId(stable);
      socket.emit("stream:start", { channelId, kind: "screen", streamId: stable });
    }

    const track = stream.getVideoTracks()[0];
    track.addEventListener("ended", () => {
      screenStop();
    });
  }, [channelId, getSendTransport, socket]);

  const screenStop = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenSharing(false);
    setScreenBroadcasting(false);
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;

    try { screenVideoProducerRef.current?.close?.(); } catch {}
    screenVideoProducerRef.current = null;

    if (socket && screenId) {
      socket.emit("stream:stop", { channelId, streamId: screenId });
    }
    setScreenId(null);
  }, [channelId, screenId, socket]);

  const screenStartBroadcast = useCallback(() => {
    if (!screenSharing) return;
    setScreenBroadcasting(true);
    if (socket && screenId) {
      socket.emit("stream:broadcast:start", { channelId, streamId: screenId });
    }
  }, [channelId, screenId, screenSharing, socket]);

  const screenStopBroadcast = useCallback(() => {
    setScreenBroadcasting(false);
    if (socket && screenId) {
      socket.emit("stream:broadcast:stop", { channelId, streamId: screenId });
    }
  }, [channelId, screenId, socket]);

  const screenCapture = useCallback(() => {
    const video = screenVideoRef.current;
    if (!video || !video.srcObject) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `screen-${Date.now()}.png`;
    a.click();
  }, []);

  const screenStartRecording = useCallback(() => {
    if (!screenStreamRef.current || screenRecording) return;
    const rec = new MediaRecorder(screenStreamRef.current, { mimeType: "video/webm;codecs=vp8" });
    screenRecorderRef.current = rec;
    screenChunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) screenChunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(screenChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setScreenRecordUrl(url);
    };
    rec.start(1000);
    setScreenRecording(true);
  }, [screenRecording]);

  const screenStopRecording = useCallback(() => {
    if (screenRecorderRef.current) {
      screenRecorderRef.current.stop();
      screenRecorderRef.current = null;
    }
    setScreenRecording(false);
  }, []);

  // ----------------------- Quality control -----------------------
  const setPreferredQuality = useCallback((layer: 0 | 1 | 2 | null) => {
    setPreferredLayer(layer);
    // Apply to existing video consumers
    consumersRef.current.forEach(async ({ consumer, kind }) => {
      if (kind !== "video") return;
      if (typeof consumer.setPreferredLayers !== "function") return;
      try {
        if (layer === null) {
          // Reset to highest by choosing 2 (assuming 3 layers produced)
          await consumer.setPreferredLayers({ spatialLayer: 2 });
        } else {
          await consumer.setPreferredLayers({ spatialLayer: layer });
        }
      } catch {
        /* ignore for codecs without layers */
      }
    });
  }, []);

  // ----------------------- refresh producers -----------------------
  const refreshProducers = useCallback(async () => {
    const s = socket as any;
    if (s && typeof s.__refreshProducers === "function" && viewAllowed) await s.__refreshProducers();
  }, [socket, viewAllowed]);

  // ----------------------- clear helpers -----------------------
  const clearCameraRequest = (idx: number) =>
    setIncomingCameraRequests((prev) => prev.filter((_, i) => i !== idx));
  const clearJoinRequest = (idx: number) =>
    setIncomingJoinRequests((prev) => prev.filter((_, i) => i !== idx));

  // ----------------------- end broadcast -----------------------
  const endBroadcast = useCallback(() => {
    if (!socket) return;
    socket.emit("broadcast:end", {});
    // also stop locally
    cameraStop();
    screenStop();
  }, [socket, cameraStop, screenStop]);

  // ----------------------- car command queue -----------------------
  const processQueue = useCallback(() => {
    if (!socket || cmdBusyRef.current) return;
    const next = () => {
      const it = cmdQueueRef.current.shift();
      if (!it) {
        cmdBusyRef.current = false;
        return;
      }
      socket.emit("car-command", it);
      setTimeout(next, 50); // ~20 msgs/sec
    };
    cmdBusyRef.current = true;
    next();
  }, [socket]);

  const sendCarCommand = useCallback((action: string, value?: unknown) => {
    if (!socket || connStatus !== "connected") return;
    cmdQueueRef.current.push({ action, value });
    processQueue();
  }, [socket, connStatus, processQueue]);

  // ----------------------- provider value -----------------------
  const value: MediaCtx = {
    socket,
    connStatus,
    status: connStatus,
    lastDisconnect,
    channelId,
    streams,
    remotes,
    devices,

    setViewingAllowed: (allowed: boolean) => setViewAllowed(allowed),
    setPreferredQuality,

    camera: {
      isOn: cameraOn,
      micMuted,
      bindVideo: cameraBindVideo,
      start: cameraStart,
      stop: cameraStop,
      toggleMic: cameraToggleMic,
      capture: cameraCapture,
    },
    screen: {
      isSharing: screenSharing,
      isBroadcasting: screenBroadcasting,
      isRecording: screenRecording,
      recordUrl: screenRecordUrl,
      streamId: screenId,
      bindVideo: screenBindVideo,
      start: screenStart,
      stop: screenStop,
      startBroadcast: screenStartBroadcast,
      stopBroadcast: screenStopBroadcast,
      capture: screenCapture,
      startRecording: screenStartRecording,
      stopRecording: screenStopRecording,
    },
    incomingCameraRequests,
    clearCameraRequest,
    incomingJoinRequests,
    clearJoinRequest,

    startCamera: cameraStart,
    stopCamera: cameraStop,
    startScreen: screenStart,
    stopScreen: screenStop,

    bindRemote,
    bindPeerAudio,
    localCameraStream: cameraStreamRef.current,
    localScreenStream: screenStreamRef.current,

    refreshProducers,
    endBroadcast,
    sendCarCommand,
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
};

export const useMedia = () => {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error("useMedia must be used inside MediaProvider");
  return ctx;
};
