/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ====== ESM dirname ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== basic express ======
const app = express();
const httpServer = http.createServer(app);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// ====== socket.io ======
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 20000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
});

// ====== state ======
type StreamKind = "screen" | "camera" | "custom";

interface StreamState {
  id: string;
  kind: StreamKind;
  ownerId: string;
  controlEnabled: boolean;
  controllerId: string | null;
  qualities: Array<{
    id: string;
    label: string;
    width?: number;
    height?: number;
    maxBitrate?: number;
    maxFramerate?: number;
  }> | null;
  createdAt: number;
}

interface ChannelState {
  id: string;
  viewerRoom: string;
  controlRoom: string;
  streams: Map<string, StreamState>;
}

const DEFAULT_CHANNEL = "global";
const channels = new Map<string, ChannelState>();
const socketChannels = new Map<string, Set<string>>();

const lastEventTime: Record<string, number> = {};
const REMOTE_EVENT_MIN_INTERVAL_MS = 35;

function getOrCreateChannel(id: string): ChannelState {
  let ch = channels.get(id);
  if (!ch) {
    ch = {
      id,
      viewerRoom: `ch:${id}:viewers`,
      controlRoom: `ch:${id}:control`,
      streams: new Map(),
    };
    channels.set(id, ch);
  }
  return ch;
}

function createStream(ch: ChannelState, ownerId: string, kind: StreamKind) {
  const stream: StreamState = {
    id: `${kind}:${ownerId}:${Date.now()}`,
    kind,
    ownerId,
    controlEnabled: false,
    controllerId: null,
    qualities: null,
    createdAt: Date.now(),
  };
  ch.streams.set(stream.id, stream);
  return stream;
}

function canSendRealtime(socketId: string) {
  const now = Date.now();
  const prev = lastEventTime[socketId] ?? 0;
  if (now - prev < REMOTE_EVENT_MIN_INTERVAL_MS) return false;
  lastEventTime[socketId] = now;
  return true;
}

function log(...args: any[]) {
  console.log("[sig]", ...args);
}

// ====== socket logic ======
io.on("connection", (socket: Socket) => {
  log("client connected:", socket.id);

  // ادخله القناة الافتراضية كمشاهد
  const ch = getOrCreateChannel(DEFAULT_CHANNEL);
  socket.join(ch.viewerRoom);
  socketChannels.set(socket.id, new Set([DEFAULT_CHANNEL]));

  // رجّع له الستريمات الحالية
  if (ch.streams.size > 0) {
    socket.emit(
      "channel:streams",
      Array.from(ch.streams.values()).map((s) => ({
        channelId: ch.id,
        streamId: s.id,
        kind: s.kind,
        ownerId: s.ownerId,
        controlEnabled: s.controlEnabled,
        qualities: s.qualities,
      }))
    );
  }

  // ===== join channel =====
  socket.on(
    "channel:join",
    (data: { channelId?: string; role?: "viewer" | "control" }) => {
      const channelId = data?.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);

      socket.join(C.viewerRoom);
      if (data.role === "control") {
        socket.join(C.controlRoom);
      }

      const set = socketChannels.get(socket.id) || new Set<string>();
      set.add(channelId);
      socketChannels.set(socket.id, set);

      socket.emit(
        "channel:streams",
        Array.from(C.streams.values()).map((s) => ({
          channelId,
          streamId: s.id,
          kind: s.kind,
          ownerId: s.ownerId,
          controlEnabled: s.controlEnabled,
          qualities: s.qualities,
        }))
      );
    }
  );

  // ===== generic signaling (لو بتسوي webrtc) =====
  socket.on("signal", (payload: any) => {
    if (!payload?.to) {
      socket.emit("signal:error", { message: "signal must have 'to'" });
      return;
    }
    io.to(payload.to).emit("signal", { ...payload, from: socket.id });
  });

  // ===== start stream =====
  socket.on(
    "stream:start",
    (data: { channelId?: string; kind: StreamKind }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);

      const stream = createStream(C, socket.id, data.kind);

      io.to(C.viewerRoom).emit("stream:started", {
        channelId,
        streamId: stream.id,
        kind: stream.kind,
        ownerId: stream.ownerId,
        controlEnabled: stream.controlEnabled,
        at: Date.now(),
      });
      io.to(C.controlRoom).emit("stream:started", {
        channelId,
        streamId: stream.id,
        kind: stream.kind,
        ownerId: stream.ownerId,
        controlEnabled: stream.controlEnabled,
        at: Date.now(),
      });
    }
  );

  // ===== stop stream =====
  socket.on("stream:stop", (data: { channelId?: string; streamId: string }) => {
    const channelId = data.channelId || DEFAULT_CHANNEL;
    const C = getOrCreateChannel(channelId);
    const stream = C.streams.get(data.streamId);
    if (!stream) return;
    if (stream.ownerId !== socket.id) return;

    C.streams.delete(stream.id);

    io.to(C.viewerRoom).emit("stream:stopped", {
      channelId,
      streamId: stream.id,
      kind: stream.kind,
      ownerId: stream.ownerId,
      at: Date.now(),
    });
    io.to(C.controlRoom).emit("stream:stopped", {
      channelId,
      streamId: stream.id,
      kind: stream.kind,
      ownerId: stream.ownerId,
      at: Date.now(),
    });
  });

  // ===== broadcast qualities (per-stream) =====
  socket.on(
    "broadcast:qualities",
    (data: {
      channelId?: string;
      streamId?: string;
      qualities: Array<{
        id: string;
        label: string;
        width?: number;
        height?: number;
        maxBitrate?: number;
        maxFramerate?: number;
      }>;
    }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);

      // حاول تلقى ستريم المالك
      const stream =
        (data.streamId && C.streams.get(data.streamId)) ||
        Array.from(C.streams.values()).find(
          (s) =>
            s.ownerId === socket.id &&
            (s.kind === "screen" || s.kind === "camera")
        );
      if (!stream) return;
      if (stream.ownerId !== socket.id) return;

      stream.qualities = data.qualities ?? [];

      io.to(C.viewerRoom).emit("broadcast:qualities:update", {
        by: socket.id,
        channelId,
        streamId: stream.id,
        qualities: stream.qualities,
      });
      io.to(C.controlRoom).emit("broadcast:qualities:update", {
        by: socket.id,
        channelId,
        streamId: stream.id,
        qualities: stream.qualities,
      });
    }
  );

  // ===== remote control enable / disable / grant / revoke =====
  socket.on(
    "stream:control:enable",
    (data: { channelId?: string; streamId: string }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const stream = C.streams.get(data.streamId);
      if (!stream) return;
      if (stream.ownerId !== socket.id) return;
      stream.controlEnabled = true;
      io.to(C.controlRoom).emit("stream:control:enabled", {
        channelId,
        streamId: stream.id,
      });
    }
  );

  socket.on(
    "stream:control:disable",
    (data: { channelId?: string; streamId: string }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const stream = C.streams.get(data.streamId);
      if (!stream) return;
      if (stream.ownerId !== socket.id) return;

      stream.controlEnabled = false;
      if (stream.controllerId) {
        io.to(stream.controllerId).emit("remote:control-revoked", {
          by: socket.id,
          at: Date.now(),
          channelId,
          streamId: stream.id,
        });
      }
      stream.controllerId = null;

      io.to(C.controlRoom).emit("stream:control:disabled", {
        channelId,
        streamId: stream.id,
      });
    }
  );

  socket.on(
    "stream:control:grant",
    (data: { channelId?: string; streamId: string; to: string }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const stream = C.streams.get(data.streamId);
      if (!stream) return;
      if (stream.ownerId !== socket.id) return;
      if (!stream.controlEnabled) return;

      stream.controllerId = data.to;

      io.to(data.to).emit("remote:control-granted", {
        by: socket.id,
        at: Date.now(),
        channelId,
        streamId: stream.id,
      });

      io.to(C.controlRoom).emit("remote:control-owner", {
        channelId,
        streamId: stream.id,
        controller: data.to,
      });
    }
  );

  socket.on(
    "stream:control:revoke",
    (data: { channelId?: string; streamId: string }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const stream = C.streams.get(data.streamId);
      if (!stream) return;
      if (stream.ownerId !== socket.id) return;

      if (stream.controllerId) {
        io.to(stream.controllerId).emit("remote:control-revoked", {
          by: socket.id,
          at: Date.now(),
          channelId,
          streamId: stream.id,
        });
      }
      stream.controllerId = null;
      io.to(C.controlRoom).emit("stream:control:revoked", {
        channelId,
        streamId: stream.id,
      });
    }
  );

  // ===== remote mouse / key (controller -> owner) =====
  socket.on("remote:mouse", (payload: any) => {
    const channelId = payload?.channelId || DEFAULT_CHANNEL;
    const streamId = payload?.streamId;
    if (!streamId) return;
    const C = getOrCreateChannel(channelId);
    const stream = C.streams.get(streamId);
    if (!stream) return;
    if (!canSendRealtime(socket.id)) return;
    if (stream.controllerId !== socket.id) return;
    io.to(stream.ownerId).emit("remote:mouse", payload);
  });

  socket.on("remote:key", (payload: any) => {
    const channelId = payload?.channelId || DEFAULT_CHANNEL;
    const streamId = payload?.streamId;
    if (!streamId) return;
    const C = getOrCreateChannel(channelId);
    const stream = C.streams.get(streamId);
    if (!stream) return;
    if (!canSendRealtime(socket.id)) return;
    if (stream.controllerId !== socket.id) return;
    io.to(stream.ownerId).emit("remote:key", payload);
  });

  // ===== backward compat =====
  socket.on("screen-share:start", () => {
    socket.emit("use-new-api", { message: "use stream:start screen" });
  });
  socket.on("camera:start", () => {
    socket.emit("use-new-api", { message: "use stream:start camera" });
  });

  // ===== disconnect =====
  socket.on("disconnect", () => {
    log("client disconnected:", socket.id);
    const joined = socketChannels.get(socket.id);
    if (joined) {
      for (const channelId of joined) {
        const C = getOrCreateChannel(channelId);

        for (const stream of Array.from(C.streams.values())) {
          if (stream.ownerId === socket.id) {
            C.streams.delete(stream.id);
            io.to(C.viewerRoom).emit("stream:stopped", {
              channelId,
              streamId: stream.id,
              kind: stream.kind,
              ownerId: stream.ownerId,
              at: Date.now(),
            });
            io.to(C.controlRoom).emit("stream:stopped", {
              channelId,
              streamId: stream.id,
              kind: stream.kind,
              ownerId: stream.ownerId,
              at: Date.now(),
            });
          } else if (stream.controllerId === socket.id) {
            stream.controllerId = null;
            io.to(stream.ownerId).emit("remote:control-revoked", {
              by: socket.id,
              at: Date.now(),
              channelId,
              streamId: stream.id,
            });
          }
        }
      }
    }

    delete lastEventTime[socket.id];
    socketChannels.delete(socket.id);
  });
});

// ===== SPA fallback =====
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = Number(process.env.PORT) || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 signaling server on http://localhost:${PORT}`);
  console.log("📡 multi-channel / multi-stream / per-stream-control ready");
});
