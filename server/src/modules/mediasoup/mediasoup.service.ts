// backend/src/modules/mediasoup/mediasoup.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as mediasoup from "mediasoup";
import {
  type Worker,
  type WebRtcTransport,
  type RtpCapabilities,
  type Producer,
  type Consumer,
} from "mediasoup/node/lib/types";
import {
  MediasoupRoom,
  MediasoupPeer,
  MediaRole,
  CreateTransportOpts,
} from "./mediasoup.types";
import { BroadcastService } from "../broadcast/broadcast.service";
import { JoinRequestsService } from "../join-requests/join-requests.service";

type VehicleInfo = {
  label: string;
  ownerUserId: number | null;
};

@Injectable()
export class MediasoupService {
  private readonly log = new Logger(MediasoupService.name);

  private worker: Worker | null = null;
  private rooms = new Map<string, MediasoupRoom>();

  // vehicle apikey → {label, ownerUserId}
  private vehicleKeys = new Map<string, VehicleInfo>();

  constructor(
    private readonly config: ConfigService,
    private readonly broadcast: BroadcastService,
    private readonly joinReqs: JoinRequestsService,
  ) {}

  async onModuleInit() {
    await this.createWorker();

    const keys =
      (this.config.get<{ key: string; label?: string; ownerUserId?: number }[]>(
        "mediasoup.vehicleApiKeys",
      ) || []);

    for (const v of keys) {
      this.vehicleKeys.set(v.key, {
        label: v.label || "vehicle",
        ownerUserId: v.ownerUserId ?? null,
      });
    }

    this.log.log("MediasoupService initialized");
  }

  validateVehicleKey(key: string): boolean {
    return this.vehicleKeys.has(key);
  }

  getVehicleInfo(key: string): VehicleInfo | null {
    return this.vehicleKeys.get(key) ?? null;
  }

  private async createWorker() {
    if (this.worker) return this.worker;

    const workerSettings =
      this.config.get<any>("mediasoup.workerSettings") ?? {
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
        logLevel: "warn",
        logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
      };

    this.worker = await mediasoup.createWorker(workerSettings);

    this.worker.on("died", () => {
      this.log.error("mediasoup worker died, exiting...");
      process.exit(1);
    });

    return this.worker;
  }

  async getOrCreateRoom(channelId: string): Promise<MediasoupRoom> {
    const existing = this.rooms.get(channelId);
    if (existing) return existing;

    const worker = await this.createWorker();
    const mediaCodecs = this.config.get<any>("mediasoup.mediaCodecs") || [];
    const router = await worker.createRouter({ mediaCodecs });

    const room: MediasoupRoom = {
      id: channelId,
      router,
      peers: new Map(),
    };

    this.rooms.set(channelId, room);
    return room;
  }

  async joinRoom(
    socketId: string,
    payload: {
      channelId: string;
      role: MediaRole;
      userId?: number;
      username?: string;
      vehicleKey?: string;
    },
  ): Promise<MediasoupPeer> {
    const room = await this.getOrCreateRoom(payload.channelId);

    // لو كان مركبة ومعاها owner مخزّن → نعتمد owner
    let finalUserId = payload.userId ?? null;
    if (payload.vehicleKey) {
      const info = this.getVehicleInfo(payload.vehicleKey);
      if (info?.ownerUserId) {
        finalUserId = info.ownerUserId;
      }
    }

    const peer: MediasoupPeer = {
      id: socketId,
      userId: finalUserId,
      username: payload.username ?? null,
      role: payload.role,
      channelId: payload.channelId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      isBroadcaster:
        payload.role === "ADMIN" || payload.role === "BROADCAST_MANAGER",
      vehicleKey: payload.vehicleKey,
    };

    room.peers.set(socketId, peer);
    return peer;
  }

  async leaveRoom(socketId: string) {
    for (const room of this.rooms.values()) {
      const peer = room.peers.get(socketId);
      if (!peer) continue;

      for (const p of peer.producers.values()) {
        try {
          await this.broadcast.removeByExternalId(p.id);
        } catch (e) {
          this.log.warn(
            `failed to remove broadcast source for producer ${p.id}: ${String(e)}`,
          );
        }
      }

      for (const t of peer.transports.values()) {
        try {
          await t.close();
        } catch {}
      }
      for (const p of peer.producers.values()) {
        try {
          await p.close();
        } catch {}
      }
      for (const c of peer.consumers.values()) {
        try {
          await c.close();
        } catch {}
      }

      room.peers.delete(socketId);
      if (room.peers.size === 0) this.rooms.delete(room.id);
      break;
    }
  }

  async createWebRtcTransport(
    peerId: string,
    opts: CreateTransportOpts,
  ): Promise<WebRtcTransport> {
    const peer = this.findPeer(peerId);
    if (!peer) throw new UnauthorizedException("peer not found");

    if (opts.direction === "send" && peer.role === "VIEWER") {
      // viewer ما يرسل إلا إذا عنده طلب approved (يتحقق في produce)
      // هنا نمنع بس اللي يحاول يرسل بدري
      throw new ForbiddenException("viewer cannot send transport");
    }

    const room = await this.getOrCreateRoom(peer.channelId);
    const listenIps =
      this.config.get<any>("mediasoup.listenIps") || [
        { ip: "0.0.0.0", announcedIp: null },
      ];

    const transport = await room.router.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      appData: { direction: opts.direction },
    });

    peer.transports.set(transport.id, transport);

    return transport;
  }

  async connectTransport(
    peerId: string,
    transportId: string,
    dtlsParameters: any,
  ) {
    const peer = this.findPeer(peerId);
    if (!peer) throw new UnauthorizedException("peer not found");

    const transport = peer.transports.get(transportId);
    if (!transport) throw new UnauthorizedException("transport not found");

    await transport.connect({ dtlsParameters });
  }

  async produce(
    peerId: string,
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: any,
    appData?: any,
  ): Promise<Producer> {
    const peer = this.findPeer(peerId);
    if (!peer) throw new UnauthorizedException("peer not found");

    // 👇 هذا هو السبب اللي كان يطلع شاشة سوده
    // سابقًا: أي viewer ممنوع ينتج
    // الآن: viewer مسموح إذا عنده طلب CAMERA/ROLE_UPGRADE approved
    if (peer.role === "VIEWER") {
      const ok =
        peer.vehicleKey // مركبة → مملوكة للمالك → مسموح
          ? true
          : peer.userId
            ? await this.joinReqs.hasApprovedCameraOrUpgrade(peer.userId)
            : false;

      if (!ok) {
        throw new ForbiddenException(
          "viewer cannot produce without approved CAMERA/ROLE_UPGRADE",
        );
      }
    }

    const transport = peer.transports.get(transportId);
    if (!transport) throw new UnauthorizedException("transport not found");

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData,
    });

    peer.producers.set(producer.id, producer);

    const mediaTag = appData?.mediaTag as string | undefined;
    const mappedKind =
      mediaTag && mediaTag.startsWith("screen")
        ? "screen"
        : kind === "video"
          ? "camera"
          : "custom";

    try {
      await this.broadcast.upsertFromMediasoup({
        producerId: producer.id,
        userId: peer.userId ?? null,
        socketId: peer.id,
        kind: mappedKind === "screen" ? "screen" : "camera",
        onAir: true,
        name:
          mediaTag ??
          (mappedKind === "screen"
            ? "Screen"
            : kind === "video"
              ? "Camera"
              : "Audio"),
      });
    } catch (e) {
      this.log.warn(
        `failed to upsert broadcast source for producer ${producer.id}: ${String(
          e,
        )}`,
      );
    }

    return producer;
  }

  async consume(
    peerId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<{ consumer: Consumer; producerPeer: MediasoupPeer }> {
    const peer = this.findPeer(peerId);
    if (!peer) throw new UnauthorizedException("peer not found");

    const room = await this.getOrCreateRoom(peer.channelId);

    const producerPeer = this.findPeerByProducerId(peer.channelId, producerId);
    if (!producerPeer) {
      throw new UnauthorizedException("producer not found");
    }

    const producer = producerPeer.producers.get(producerId);
    if (!producer) {
      throw new UnauthorizedException("producer not found");
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new ForbiddenException("cannot consume this producer");
    }

    const recvTransport = Array.from(peer.transports.values()).find(
      (t) => t.appData?.direction === "recv",
    );
    if (!recvTransport) {
      throw new UnauthorizedException("no transport to consume");
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    peer.consumers.set(consumer.id, consumer);

    return { consumer, producerPeer };
  }

  findPeer(peerId: string): MediasoupPeer | null {
    for (const room of this.rooms.values()) {
      const peer = room.peers.get(peerId);
      if (peer) return peer;
    }
    return null;
  }

  findPeerByProducerId(
    channelId: string,
    producerId: string,
  ): MediasoupPeer | null {
    const room = this.rooms.get(channelId);
    if (!room) return null;
    for (const peer of room.peers.values()) {
      if (peer.producers.has(producerId)) return peer;
    }
    return null;
  }

  listRooms() {
    return Array.from(this.rooms.values()).map((r) => ({
      id: r.id,
      peers: Array.from(r.peers.values()).map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        role: p.role,
        isBroadcaster: p.isBroadcaster,
      })),
    }));
  }
}
