/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MediasoupGateway — hardened signaling layer
 * - Auth via JWT / API key
 * - Room join on default channel
 * - Guard: viewers cannot create SEND transports unless explicitly approved
 * - Produce:
 *   * Only persist VIDEO kinds (camera/screen) to avoid audio-only duplicates
 *   * Clear socket placeholders once real video is produced
 * - Stream lifecycle sockets (start/stop, broadcast start/stop)
 * - New: "broadcast:end" to let host/admin end their session cleanly
 *
 * Notes:
 * - We keep DB writes minimal and push stream lists after each change
 * - We never produce audio "entries" to avoid duplicate rows like camera-audio/camera-video
 */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MediasoupService } from "./mediasoup.service";
import { MediaRole } from "./mediasoup.types";
import { BroadcastService } from "../broadcast/broadcast.service";

@WebSocketGateway({
  cors: { origin: "*", methods: ["GET", "POST"] },
  namespace: "/mediasoup",
})
export class MediasoupGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly jwtSecret: string;
  private readonly defaultChannel: string;

  constructor(
    private readonly mediasoup: MediasoupService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly broadcast: BroadcastService,
  ) {
    this.jwtSecret =
      this.config.get<string>("mediasoup.jwtSecret") || "smartcar-secret";
    this.defaultChannel =
      this.config.get<string>("mediasoup.defaultChannel") || "global";
  }

  // ------------------------ helpers ------------------------

  /** Extract identity/role from client handshake. */
  private extractAuth(client: Socket): {
    userId: number | null;
    role: MediaRole;
    username: string | null;
    vehicleKey?: string;
  } {
    const token =
      (client.handshake.auth && client.handshake.auth.token) ||
      (typeof client.handshake.query?.token === "string" && client.handshake.query.token) ||
      null;

    const apikey =
      (typeof client.handshake.query?.apikey === "string" && client.handshake.query.apikey) || null;

    if (apikey) {
      const ok = this.mediasoup.validateVehicleKey(apikey);
      if (!ok) return { userId: null, role: "VIEWER", username: null };
      return {
        userId: null,
        role: "VEHICLE",
        username: `vehicle:${apikey.slice(0, 6)}`,
        vehicleKey: apikey,
      };
    }

    if (token) {
      try {
        const decoded: any = this.jwt.verify(token, { secret: this.jwtSecret });
        const userId = decoded.sub || decoded.userId || null;
        const username =
          decoded.username || decoded.email || (userId ? `user:${userId}` : null);
        const decodedRole = decoded.role as MediaRole;
        const role: MediaRole =
          decodedRole === "ADMIN" ||
          decodedRole === "BROADCAST_MANAGER" ||
          decodedRole === "VEHICLE"
            ? decodedRole
            : "VIEWER";
        return { userId, role, username };
      } catch {
        return { userId: null, role: "VIEWER", username: null };
      }
    }
    return { userId: null, role: "VIEWER", username: null };
  }

  private async getPeerAndChannel(
    client: Socket,
    overrideChannel?: string,
  ): Promise<{ channelId: string; peer: any | null }> {
    const peer = this.mediasoup.findPeer(client.id);
    const channelId = overrideChannel || peer?.channelId || this.defaultChannel;
    return { channelId, peer };
  }

  private async pushStreamsList(channelId: string) {
    const all = await this.broadcast.listAllOnAirSources();
    this.server.to(channelId).emit("streams:list", all);
  }

  // ---------------------- lifecycle ------------------------

  async handleConnection(client: Socket) {
    const { userId, role, username, vehicleKey } = this.extractAuth(client);

    // Vehicle key must map to VEHICLE role (paranoia guard)
    if (vehicleKey && role !== "VEHICLE") {
      client.disconnect();
      return;
    }

    const channelId = this.defaultChannel;

    await this.mediasoup.joinRoom(client.id, {
      channelId,
      role,
      userId: userId ?? undefined,
      username: username ?? undefined,
      vehicleKey,
    });

    client.join(channelId);
    client.emit("ready", { role, channelId });
  }

  async handleDisconnect(client: Socket) {
    await this.mediasoup.leaveRoom(client.id);
    try {
      await this.broadcast.stopSocketStream(client.id);
      await this.pushStreamsList(this.defaultChannel);
    } catch {
      /* ignore persistence issues */
    }
  }

  // -------------------- mediasoup signaling --------------------

  @SubscribeMessage("getRouterRtpCapabilities")
  async onGetRouterRtpCapabilities(@ConnectedSocket() client: Socket) {
    const peer = this.mediasoup.findPeer(client.id);
    if (!peer) return;
    const room = await this.mediasoup.getOrCreateRoom(peer.channelId);
    client.emit("routerRtpCapabilities", room.router.rtpCapabilities);
  }

  @SubscribeMessage("createWebRtcTransport")
  async onCreateTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { direction: "send" | "recv" },
  ) {
    // Guard send for viewers: service will also throw, but we soft-block here to avoid noise
    if (body.direction === "send") {
      const peer = this.mediasoup.findPeer(client.id);
      const role = peer?.role || "VIEWER";
      const canSend =
        role === "ADMIN" || role === "BROADCAST_MANAGER" || role === "VEHICLE";
      if (!canSend) {
        // Send a friendly event (frontend will keep buttons hidden anyway)
        client.emit("permission:denied", { reason: "viewer cannot send transport" });
        return;
      }
    }

    const transport = await this.mediasoup.createWebRtcTransport(client.id, {
      peerId: client.id,
      direction: body.direction,
    });

    client.emit("transportCreated", {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  }

  @SubscribeMessage("listProducers")
  async onListProducers(@ConnectedSocket() client: Socket) {
    const peer = this.mediasoup.findPeer(client.id);
    if (!peer) return client.emit("producers", []);
    const room = await this.mediasoup.getOrCreateRoom(peer.channelId);
    const ids: string[] = [];
    for (const p of room.peers.values()) {
      for (const prod of p.producers.keys()) ids.push(prod);
    }
    client.emit("producers", ids);
  }

  @SubscribeMessage("connectWebRtcTransport")
  async onConnectTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { transportId: string; dtlsParameters: any },
  ) {
    await this.mediasoup.connectTransport(
      client.id,
      body.transportId,
      body.dtlsParameters,
    );
    client.emit("transportConnected", { transportId: body.transportId });
  }

  /**
   * Produce:
   * - Notify room
   * - Persist VIDEO kinds only (camera/screen)
   * - Clear any socket placeholders first to prevent duplicates
   */
  @SubscribeMessage("produce")
  async onProduce(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      transportId: string;
      kind: "audio" | "video";
      rtpParameters: any;
      appData?: any;
    },
  ) {
    const producer = await this.mediasoup.produce(
      client.id,
      body.transportId,
      body.kind,
      body.rtpParameters,
      body.appData,
    );

    const peer = this.mediasoup.findPeer(client.id);
    if (peer) {
      this.server
        .to(peer.channelId)
        .emit("newProducer", { producerId: producer.id, peerId: peer.id });
    }

    // Persist real video only
    const tag = String(body.appData?.mediaTag || "");
    const isCameraVideo = body.kind === "video" && tag.startsWith("camera");
    const isScreenVideo = body.kind === "video" && tag.startsWith("screen");

    if (peer) {
      try {
        await this.broadcast.stopSocketStream(client.id);

        if (isCameraVideo) {
          await this.broadcast.upsertFromMediasoup({
            producerId: producer.id,
            userId: peer.userId ?? null,
            socketId: peer.id,
            kind: "camera",
            onAir: true,
            name: "HOST_CAMERA",
          });
        } else if (isScreenVideo) {
          await this.broadcast.upsertFromMediasoup({
            producerId: producer.id,
            userId: peer.userId ?? null,
            socketId: peer.id,
            kind: "screen",
            onAir: true,
            name: "HOST_SCREEN",
          });
        } else {
          await this.broadcast.upsertFromMediasoup({
            producerId: producer.id,
            userId: peer.userId ?? null,
            socketId: peer.id,
            kind: "custom",
            onAir: true,
            name: tag || "CUSTOM_VIDEO",
          });
        }

        await this.pushStreamsList(peer.channelId);
      } catch {
        /* resilience over perfection */
      }
    }

    client.emit("produced", { producerId: producer.id });
  }

  @SubscribeMessage("consume")
  async onConsume(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { producerId: string; rtpCapabilities: any },
  ) {
    const { consumer, producerPeer } = await this.mediasoup.consume(
      client.id,
      body.producerId,
      body.rtpCapabilities,
    );

    client.emit("consumed", {
      producerId: body.producerId,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      peerId: producerPeer.id,
    });
  }

  // ---------------- app-level stream signals ----------------

  @SubscribeMessage("stream:start")
  async onStreamStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      channelId?: string;
      kind: "camera" | "screen";
      streamId?: string; // stable id from client
      opts?: any;
    },
  ) {
    const { channelId, peer } = await this.getPeerAndChannel(
      client,
      body.channelId,
    );

    await this.broadcast.upsertFromSocketStream({
      userId: peer?.userId ?? null,
      socketId: client.id,
      channelId,
      kind: body.kind,
      streamId: body.streamId,
      name: body.opts?.label ?? body.kind.toUpperCase(),
      onAir: true,
    });

    await this.pushStreamsList(channelId);
  }

  @SubscribeMessage("stream:stop")
  async onStreamStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string; streamId?: string },
  ) {
    const { channelId } = await this.getPeerAndChannel(client, body.channelId);
    await this.broadcast.stopSocketStream(client.id, body.streamId ?? null);
    await this.pushStreamsList(channelId);
  }

  @SubscribeMessage("stream:broadcast:start")
  async onStreamBroadcastStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      channelId?: string;
      streamId?: string;
      kind?: "camera" | "screen";
    },
  ) {
    const { channelId, peer } = await this.getPeerAndChannel(
      client,
      body.channelId,
    );

    await this.broadcast.upsertFromSocketStream({
      userId: peer?.userId ?? null,
      socketId: client.id,
      channelId,
      kind: body.kind ?? "camera",
      streamId: body.streamId,
      onAir: true,
    });

    await this.pushStreamsList(channelId);
  }

  @SubscribeMessage("stream:broadcast:stop")
  async onStreamBroadcastStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string; streamId?: string },
  ) {
    const { channelId } = await this.getPeerAndChannel(client, body.channelId);
    await this.broadcast.stopSocketStream(client.id, body.streamId ?? null);
    await this.pushStreamsList(channelId);
  }

  // Request a remote device camera
  @SubscribeMessage("device:camera:request")
  async onDeviceCameraRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channelId?: string; targetId: string },
  ) {
    const { channelId, peer } = await this.getPeerAndChannel(
      client,
      body.channelId,
    );

    this.server.to(body.targetId).emit("camera:attach-request", {
      fromSocketId: client.id,
      fromUserId: peer?.userId ?? null,
      channelId,
      at: Date.now(),
    });
  }

  // Join request (VIEW / CAMERA / ROLE_UPGRADE / SCREEN)
  @SubscribeMessage("joinBroadcastRequest")
  async onJoinBroadcastRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { targetUserId: number; message?: string; intent?: "VIEW" | "CAMERA" | "SCREEN" | "ROLE_UPGRADE" },
  ) {
    const { channelId, peer } = await this.getPeerAndChannel(client);
    this.server.to(channelId).emit("join-broadcast:incoming", {
      from: {
        socketId: client.id,
        userId: peer?.userId ?? null,
        username: peer?.username ?? null,
      },
      toUserId: body.targetUserId,
      intent: body.intent ?? "VIEW",
      message: body.message ?? null,
      at: Date.now(),
    });
  }

  /**
   * Minimal relay for join status updates.
   * Frontend will emit "join:notify" after approval/rejection to push a
   * "join-requests:status" event. We keep it channel-wide; clients filter by toUserId.
   */
  @SubscribeMessage("join:notify")
  async onJoinNotify(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      toUserId: number;
      status: "APPROVED" | "REJECTED";
      intent: "VIEW" | "CAMERA" | "SCREEN" | "ROLE_UPGRADE";
      requestId?: string | number | null;
      message?: string | null;
    },
  ) {
    const { channelId } = await this.getPeerAndChannel(client);
    this.server.to(channelId).emit("join-requests:status", {
      toUserId: body.toUserId,
      status: body.status,
      intent: body.intent,
      requestId: body.requestId ?? null,
      message: body.message ?? null,
      at: Date.now(),
    });
  }

  // Host/Admin can end broadcast quickly
  @SubscribeMessage("broadcast:end")
  async onBroadcastEnd(@ConnectedSocket() client: Socket) {
    const { channelId, peer } = await this.getPeerAndChannel(client);
    if (!peer) return;
    if (!(peer.role === "ADMIN" || peer.role === "BROADCAST_MANAGER" || peer.role === "VEHICLE")) {
      // allow owner-like roles; viewers cannot end
      client.emit("permission:denied", { reason: "not allowed to end broadcast" });
      return;
    }
    try {
      await this.broadcast.stopSocketStream(client.id);
      await this.pushStreamsList(channelId);
      client.emit("broadcast:ended", { ok: true, at: Date.now() });
    } catch {
      client.emit("broadcast:ended", { ok: false });
    }
  }
}
