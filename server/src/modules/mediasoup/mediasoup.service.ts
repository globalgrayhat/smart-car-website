/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import {
  type Worker,
  type WebRtcTransport,
  type RtpCapabilities,
  type Producer,
  type Consumer,
} from 'mediasoup/node/lib/types';
import {
  MediasoupRoom,
  MediasoupPeer,
  MediaRole,
  CreateTransportOpts,
} from './mediasoup.types';
import { BroadcastService } from '../broadcast/broadcast.service';
import { JoinRequestsService } from '../join-requests/join-requests.service';

type VehicleInfo = {
  label: string;
  ownerUserId: number | null;
};

@Injectable()
export class MediasoupService {
  private readonly log = new Logger(MediasoupService.name);

  private worker: Worker | null = null;
  private rooms = new Map<string, MediasoupRoom>();
  private vehicleKeys = new Map<string, VehicleInfo>();

  constructor(
    private readonly config: ConfigService,
    private readonly broadcast: BroadcastService,
    private readonly joinReqs: JoinRequestsService, // reserved for future access-control extensions
  ) {}

  /**
   * Initialize Mediasoup worker and preload vehicle keys from configuration.
   */
  async onModuleInit() {
    await this.createWorker();

    const keys =
      this.config.get<
        { key: string; label?: string; ownerUserId?: number }[]
      >('mediasoup.vehicleApiKeys') || [];

    for (const v of keys) {
      this.vehicleKeys.set(v.key, {
        label: v.label || 'vehicle',
        ownerUserId: v.ownerUserId ?? null,
      });
    }

    this.log.log('MediasoupService initialized');
  }

  /**
   * Check if a vehicle API key is registered.
   */
  validateVehicleKey(key: string): boolean {
    return this.vehicleKeys.has(key);
  }

  /**
   * Get metadata for a registered vehicle API key.
   */
  getVehicleInfo(key: string): VehicleInfo | null {
    return this.vehicleKeys.get(key) ?? null;
  }

  /**
   * Lazily create a single Mediasoup worker.
   */
  private async createWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    const workerSettings =
      this.config.get<any>('mediasoup.workerSettings') ?? {
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      };

    this.worker = await mediasoup.createWorker(workerSettings);

    this.worker.on('died', () => {
      this.log.error('Mediasoup worker died. Exiting process.');
      process.exit(1);
    });

    return this.worker;
  }

  /**
   * Get existing room by channelId, or create a new one with configured codecs.
   */
  async getOrCreateRoom(channelId: string): Promise<MediasoupRoom> {
    const existing = this.rooms.get(channelId);
    if (existing) return existing;

    const worker = await this.createWorker();
    const mediaCodecs = this.config.get<any>('mediasoup.mediaCodecs') || [];
    const router = await worker.createRouter({ mediaCodecs });

    const room: MediasoupRoom = {
      id: channelId,
      router,
      peers: new Map(),
    };

    this.rooms.set(channelId, room);
    return room;
  }

  /**
   * Join a room and register a peer.
   * - If a vehicleKey is mapped to an owner, associate produced media with that owner.
   */
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

    let finalUserId = payload.userId ?? null;

    // If vehicle key is mapped to a specific owner user, bind to that owner
    if (payload.vehicleKey) {
      const info = this.getVehicleInfo(payload.vehicleKey);
      if (info?.ownerUserId) {
        finalUserId = info.ownerUserId;
      }
    }

    const isBroadcaster =
      payload.role === 'ADMIN' || payload.role === 'BROADCAST_MANAGER';

    const peer: MediasoupPeer = {
      id: socketId,
      userId: finalUserId,
      username: payload.username ?? null,
      role: payload.role,
      channelId: payload.channelId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      isBroadcaster,
      vehicleKey: payload.vehicleKey,
    };

    room.peers.set(socketId, peer);
    return peer;
  }

  /**
   * Leave a room, clean up all transports/producers/consumers for that peer
   * and remove associated broadcast sources.
   */
  async leaveRoom(socketId: string) {
    for (const room of this.rooms.values()) {
      const peer = room.peers.get(socketId);
      if (!peer) continue;

      // Remove broadcast sources created for this peer's producers
      for (const p of peer.producers.values()) {
        try {
          await this.broadcast.removeByExternalId(p.id);
        } catch (e) {
          this.log.warn(
            `Failed to remove broadcast source for producer ${p.id}: ${String(
              e,
            )}`,
          );
        }
      }

      // Close transports, producers, consumers
      for (const t of peer.transports.values()) {
        try {
          t.close();
        } catch {
          // ignore
        }
      }
      for (const p of peer.producers.values()) {
        try {
          p.close();
        } catch {
          // ignore
        }
      }
      for (const c of peer.consumers.values()) {
        try {
          c.close();
        } catch {
          // ignore
        }
      }

      room.peers.delete(socketId);

      // Remove empty room
      if (room.peers.size === 0) {
        this.rooms.delete(room.id);
      }

      break;
    }
  }

  /**
   * Create a WebRTC transport for the given peer.
   */
  async createWebRtcTransport(
    peerId: string,
    opts: CreateTransportOpts,
  ): Promise<WebRtcTransport> {
    const peer = this.findPeer(peerId);
    if (!peer) {
      throw new UnauthorizedException('Peer not found');
    }

    const room = await this.getOrCreateRoom(peer.channelId);
    const listenIps =
      this.config.get<any>('mediasoup.listenIps') || [
        { ip: '0.0.0.0', announcedIp: null },
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

  /**
   * Connect DTLS for an existing transport.
   */
  async connectTransport(
    peerId: string,
    transportId: string,
    dtlsParameters: any,
  ) {
    const peer = this.findPeer(peerId);
    if (!peer) {
      throw new UnauthorizedException('Peer not found');
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new UnauthorizedException('Transport not found');
    }

    await transport.connect({ dtlsParameters });
  }

  /**
   * Create a producer (send media).
   *
   * Authorization:
   * - ADMIN, BROADCAST_MANAGER, VEHICLE: allowed to produce.
   * - VIEWER: not allowed to produce (no direct publishing).
   *
   * Behavior:
   * - Only VIDEO producers create/update entries in `broadcast_sources`.
   * - AUDIO producers are kept internal and attached to the same peer/room,
   *   so the UI treats camera + mic as a single logical broadcast.
   */
  async produce(
    peerId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: any,
    appData?: any,
  ): Promise<Producer> {
    const peer = this.findPeer(peerId);
    if (!peer) {
      throw new UnauthorizedException('Peer not found');
    }

    // Enforce role-based permissions
    if (
      !(
        peer.role === 'ADMIN' ||
        peer.role === 'BROADCAST_MANAGER' ||
        peer.role === 'VEHICLE'
      )
    ) {
      throw new ForbiddenException(
        'Only broadcast owner or vehicle may start media producers',
      );
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new UnauthorizedException('Transport not found');
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData,
    });

    peer.producers.set(producer.id, producer);

    // Only register VIDEO producers as broadcast sources.
    // This prevents "duplicate" entries (separate audio rows)
    // and keeps the UI showing a single clean broadcast.
    if (kind === 'video') {
      const rawTag =
        typeof appData?.mediaTag === 'string' ? appData.mediaTag : '';
      const tag = rawTag.toLowerCase();

      const isScreen =
        tag.startsWith('screen') ||
        appData?.screen === true;

      const name =
        (appData && appData.label) ||
        (isScreen ? 'Screen share' : 'Camera');

      try {
        await this.broadcast.upsertFromMediasoup({
          producerId: producer.id,
          userId: peer.userId ?? null,
          socketId: peer.id,
          kind: isScreen ? 'screen' : 'camera',
          onAir: true,
          name,
        });
      } catch (e) {
        this.log.warn(
          `Failed to upsert broadcast source for producer ${producer.id}: ${String(
            e,
          )}`,
        );
      }
    }

    return producer;
  }

  /**
   * Create a consumer (receive media) for a given producer.
   */
  async consume(
    peerId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<{ consumer: Consumer; producerPeer: MediasoupPeer }> {
    const peer = this.findPeer(peerId);
    if (!peer) {
      throw new UnauthorizedException('Peer not found');
    }

    const room = await this.getOrCreateRoom(peer.channelId);

    const producerPeer = this.findPeerByProducerId(
      peer.channelId,
      producerId,
    );
    if (!producerPeer) {
      throw new UnauthorizedException('Producer not found');
    }

    const producer = producerPeer.producers.get(producerId);
    if (!producer) {
      throw new UnauthorizedException('Producer not found');
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new ForbiddenException('Client cannot consume this producer');
    }

    const recvTransport = Array.from(peer.transports.values()).find(
      (t) => t.appData?.direction === 'recv',
    );
    if (!recvTransport) {
      throw new UnauthorizedException('No receiving transport available');
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    peer.consumers.set(consumer.id, consumer);

    return { consumer, producerPeer };
  }

  /**
   * Find a peer by its socket/peer id across all rooms.
   */
  findPeer(peerId: string): MediasoupPeer | null {
    for (const room of this.rooms.values()) {
      const peer = room.peers.get(peerId);
      if (peer) return peer;
    }
    return null;
  }

  /**
   * Find the peer that owns a given producerId within a room.
   */
  findPeerByProducerId(
    channelId: string,
    producerId: string,
  ): MediasoupPeer | null {
    const room = this.rooms.get(channelId);
    if (!room) return null;

    for (const peer of room.peers.values()) {
      if (peer.producers.has(producerId)) {
        return peer;
      }
    }
    return null;
  }

  /**
   * List rooms and basic peer info for debugging/monitoring.
   */
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
