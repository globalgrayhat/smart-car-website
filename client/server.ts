/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json());

// serve built frontend if exists
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

/**
 * SIGNAL / SOCKET.IO
 */
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// === IMPORTANT SECRETS ==================================
// use the SAME secret that Nest uses
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.NEST_JWT_SECRET ||
  "smartcar-secret";
// ========================================================

const DEFAULT_CHANNEL = process.env.DEFAULT_CHANNEL || "global";

// channel structure in memory
const channels = new Map<
  string,
  {
    id: string;
    viewerRoom: string;
    controlRoom: string;
    streams: Map<
      string,
      {
        id: string;
        kind: "screen" | "camera" | "custom";
        ownerId: string;
        onAir: boolean;
        createdAt: number;
      }
    >;
  }
>();

function getOrCreateChannel(id: string) {
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

// === NEST / INTERNAL CONFIG =============================
const NEST_BASE_URL =
  process.env.NEST_BASE_URL || "http://localhost:3000/api";
const INTERNAL_SYNC_KEY =
  process.env.INTERNAL_SYNC_KEY || "super-secret-sync";

async function syncToNest(body: any) {
  try {
    await fetch(`${NEST_BASE_URL}/broadcast/internal/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": INTERNAL_SYNC_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.log("sync to nest failed:", e);
  }
}

async function stopInNest(externalId: string) {
  try {
    await fetch(`${NEST_BASE_URL}/broadcast/internal/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": INTERNAL_SYNC_KEY,
      },
      body: JSON.stringify({ externalId }),
    });
  } catch (e) {
    console.log("stop sync failed:", e);
  }
}

/**
 * socket auth
 * - decode JWT with the SAME secret as Nest
 */
io.use((socket, next) => {
  const token =
    (socket.handshake.auth && socket.handshake.auth.token) ||
    (socket.handshake.query && socket.handshake.query.token);

  if (token && typeof token === "string") {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      socket.data.user = {
        id: decoded.userId || decoded.sub || null,
        role: decoded.role || "VIEWER",
        username: decoded.username,
      };
    } catch (e) {
      socket.data.user = {
        id: null,
        role: "VIEWER",
        username: "guest",
      };
    }
  } else {
    socket.data.user = {
      id: null,
      role: "VIEWER",
      username: "guest",
    };
  }
  next();
});

/**
 * helper: send streams to a socket respecting role
 */
function serializeStreamsFor(
  socket: Socket,
  ch: ReturnType<typeof getOrCreateChannel>,
) {
  const role = socket.data.user?.role || "VIEWER";
  const isAdmin =
    role === "ADMIN" || role === "BROADCAST_MANAGER";

  // viewers → only onAir
  const list = Array.from(ch.streams.values()).filter((s) =>
    isAdmin ? true : s.onAir,
  );

  return list.map((s) => ({
    channelId: ch.id,
    streamId: s.id,
    kind: s.kind,
    ownerId: s.ownerId,
    onAir: s.onAir,
  }));
}

/**
 * SOCKET HANDLERS
 */
io.on("connection", (socket: Socket) => {
  const ch = getOrCreateChannel(DEFAULT_CHANNEL);

  // viewers room by default
  socket.join(ch.viewerRoom);

  // send current streams (filtered)
  socket.emit("channel:streams", serializeStreamsFor(socket, ch));

  // let control join control room
  socket.on(
    "channel:join",
    (data: { channelId?: string; role?: "viewer" | "control" | "vehicle" }) => {
      const channelId = data?.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);

      socket.join(C.viewerRoom);
      if (data.role === "control" || data.role === "vehicle") {
        socket.join(C.controlRoom);
      }

      socket.emit("channel:streams", serializeStreamsFor(socket, C));
    },
  );

  // viewer → owner: join request
  socket.on(
    "join-request:create",
    async (payload: {
      channelId?: string;
      toUserId: number;
      message?: string;
    }) => {
      const user = socket.data.user;
      if (!user?.id) return;

      const channelId = payload.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);

      // push to Nest
      try {
        await fetch(`${NEST_BASE_URL}/join-requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${socket.handshake.auth?.token || ""}`,
          },
          body: JSON.stringify({
            toUserId: payload.toUserId,
            message:
              payload.message ??
              "طلب مشاركة كاميرا / انضمام إلى البث",
          }),
        });
      } catch (e) {
        console.log("join-request http create failed:", e);
      }

      // realtime notify
      io.to(C.controlRoom).emit("join-request:incoming", {
        fromUserId: user.id,
        fromUsername: user.username,
        toUserId: payload.toUserId,
        message: payload.message ?? null,
        at: Date.now(),
      });
    },
  );

  // STREAM: start (not on-air yet)
  socket.on(
    "stream:start",
    async (data: {
      channelId?: string;
      kind: "screen" | "camera" | "custom";
    }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const id = `${data.kind}:${socket.id}:${Date.now()}`;

      const stream = {
        id,
        kind: data.kind,
        ownerId: socket.id,
        onAir: false, // important: not visible to viewers yet
        createdAt: Date.now(),
      };

      C.streams.set(id, stream);

      // notify controllers only
      io.to(C.controlRoom).emit("stream:started", {
        channelId,
        streamId: id,
        kind: data.kind,
        ownerId: socket.id,
        onAir: false,
      });

      // sync to Nest (off-air)
      await syncToNest({
        externalId: id,
        kind: data.kind,
        ownerUserId: socket.data.user?.id ?? null,
        ownerSocketId: socket.id,
        name:
          data.kind === "screen"
            ? "Host screen"
            : data.kind === "camera"
            ? "Host camera"
            : "Custom source",
        onAir: false,
      });
    },
  );

  // STREAM: broadcast start → now viewers should see it
  socket.on(
    "stream:broadcast:start",
    async (data: { channelId?: string; streamId: string }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const s = C.streams.get(data.streamId);
      if (!s) return;
      if (s.ownerId !== socket.id) return;

      s.onAir = true;
      C.streams.set(s.id, s);

      // now send to VIEWERS
      io.to(C.viewerRoom).emit("stream:started", {
        channelId,
        streamId: s.id,
        kind: s.kind,
        ownerId: s.ownerId,
        onAir: true,
      });
      io.to(C.controlRoom).emit("stream:updated", {
        channelId,
        streamId: s.id,
        onAir: true,
      });

      await syncToNest({
        externalId: s.id,
        kind: s.kind,
        ownerUserId: socket.data.user?.id ?? null,
        ownerSocketId: socket.id,
        name:
          s.kind === "screen"
            ? "Host screen"
            : s.kind === "camera"
            ? "Host camera"
            : "Custom source",
        onAir: true,
      });
    },
  );

  // STREAM: broadcast stop → hide from viewers
  socket.on(
    "stream:broadcast:stop",
    async (data: { channelId?: string; streamId: string }) => {
      const channelId = data.channelId || DEFAULT_CHANNEL;
      const C = getOrCreateChannel(channelId);
      const s = C.streams.get(data.streamId);
      if (!s) return;
      if (s.ownerId !== socket.id) return;

      s.onAir = false;
      C.streams.set(s.id, s);

      io.to(C.viewerRoom).emit("stream:stopped", {
        channelId,
        streamId: s.id,
        kind: s.kind,
        ownerId: s.ownerId,
      });
      io.to(C.controlRoom).emit("stream:updated", {
        channelId,
        streamId: s.id,
        onAir: false,
      });

      await syncToNest({
        externalId: s.id,
        kind: s.kind,
        ownerUserId: socket.data.user?.id ?? null,
        ownerSocketId: socket.id,
        name:
          s.kind === "screen"
            ? "Host screen"
            : s.kind === "camera"
            ? "Host camera"
            : "Custom source",
        onAir: false,
      });
    },
  );

  // STREAM: stop (disconnect or manual)
  socket.on(
    "stream:stop",
    async (data: { channelId?: string; streamId: string }) => {
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
      });
      io.to(C.controlRoom).emit("stream:stopped", {
        channelId,
        streamId: stream.id,
        kind: stream.kind,
        ownerId: stream.ownerId,
      });

      await stopInNest(stream.id);
    },
  );

  // direct “turn on your camera”
  socket.on(
    "camera:request-start",
    (payload: { targetId: string; requesterId?: string; reason?: string }) => {
      const target = io.sockets.sockets.get(payload.targetId);
      if (!target) return;
      target.emit("camera:on-request", {
        from: payload.requesterId ?? socket.id,
        reason: payload.reason ?? "remote",
      });
    },
  );

  // disconnect cleanup
  socket.on("disconnect", async () => {
    const C = getOrCreateChannel(DEFAULT_CHANNEL);
    for (const s of Array.from(C.streams.values())) {
      if (s.ownerId === socket.id) {
        C.streams.delete(s.id);
        await stopInNest(s.id);
        io.to(C.viewerRoom).emit("stream:stopped", {
          channelId: C.id,
          streamId: s.id,
          kind: s.kind,
          ownerId: s.ownerId,
        });
        io.to(C.controlRoom).emit("stream:stopped", {
          channelId: C.id,
          streamId: s.id,
          kind: s.kind,
          ownerId: s.ownerId,
        });
      }
    }
  });
});

/**
 * REST: list online devices (for React) - VIEWER should see only on-air
 */
app.get("/api/signal/devices", (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    // try to read bearer to know role
    const auth = req.headers.authorization;
    let role = "VIEWER";
    let userId: number | null = null;
    if (auth && auth.startsWith("Bearer ")) {
      const token = auth.slice("Bearer ".length);
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        role = decoded.role || "VIEWER";
        userId = decoded.userId || decoded.sub || null;
      } catch {
        // ignore
      }
    }

    const isAdmin =
      role === "ADMIN" || role === "BROADCAST_MANAGER";

    const devices: any[] = [];

    for (const [channelId, ch] of channels.entries()) {
      for (const st of ch.streams.values()) {
        if (!isAdmin && !st.onAir) continue; // viewer → only active
        devices.push({
          ownerId: st.ownerId,
          userId,
          label:
            st.kind === "screen"
              ? "شاشة المضيف"
              : st.kind === "camera"
              ? "كاميرا مركبة"
              : "بث مخصص",
          streamId: st.id,
          onAir: st.onAir,
        });
      }
    }

    res.json(devices);
  } catch (e) {
    console.log("GET /api/signal/devices error:", e);
    res.status(500).json({
      statusCode: 500,
      message: "حدث خطأ أثناء جلب الأجهزة المتصلة",
    });
  }
});

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT =
  Number(process.env.SIGNAL_PORT) ||
  Number(process.env.PORT) ||
  5000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 signaling + proxy server on http://localhost:${PORT}`);
});
