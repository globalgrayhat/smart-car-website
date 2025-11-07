/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MediasoupService } from './mediasoup.service';
import { MediaRole } from './mediasoup.types';
import { BroadcastService } from '../broadcast/broadcast.service';
import { UserRole } from '../users/user.entity';

@WebSocketGateway({
  cors: { origin: '*', methods: ['GET', 'POST'] },
  namespace: '/mediasoup',
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
      this.config.get<string>('mediasoup.jwtSecret') ||
      this.config.get<string>('JWT_SECRET', 'smartcar-secret');

    this.defaultChannel =
      this.config.get<string>('mediasoup.defaultChannel') || 'global';
  }

  /**
   * Extract user identity and media role from the websocket handshake.
   * - If a valid API key is provided, treat as VEHICLE.
   * - If a JWT is provided, map application roles to MediaRole.
   * - Otherwise, fallback to VIEWER.
   */
  private extractAuth(client: Socket): {
    userId: number | null;
    role: MediaRole;
    username: string | null;
    vehicleKey?: string;
  } {
    const token =
      (client.handshake.auth &&
        typeof client.handshake.auth.token === 'string' &&
        client.handshake.auth.token) ||
      (typeof client.handshake.query?.token === 'string'
        ? (client.handshake.query.token as string)
        : null);

    const apikey =
      typeof client.handshake.query?.apikey === 'string'
        ? (client.handshake.query.apikey as string)
        : null;

    // Vehicle key authentication
    if (apikey) {
      const ok = this.mediasoup.validateVehicleKey(apikey);
      if (!ok) {
        return { userId: null, role: 'VIEWER', username: null };
      }
      return {
        userId: null,
        role: 'VEHICLE',
        username: `vehicle:${apikey.slice(0, 6)}`,
        vehicleKey: apikey,
      };
    }

    // JWT-based authentication
    if (token) {
      try {
        const decoded: any = this.jwt.verify(token, {
          secret: this.jwtSecret,
        });

        const userId: number | null =
          decoded.sub || decoded.userId || null;

        const username: string | null =
          decoded.username ||
          decoded.email ||
          (userId ? `user:${userId}` : null);

        let rawRole: string | undefined =
          decoded.role ||
          (Array.isArray(decoded.roles) ? decoded.roles[0] : undefined);

        if (rawRole && typeof rawRole === 'string') {
          rawRole = rawRole.toUpperCase();
        }

        let role: MediaRole = 'VIEWER';

        if (rawRole === UserRole.ADMIN || rawRole === 'ADMIN') {
          role = 'ADMIN';
        } else if (
          rawRole === UserRole.BROADCAST_MANAGER ||
          rawRole === 'BROADCAST_MANAGER'
        ) {
          role = 'BROADCAST_MANAGER';
        } else if (rawRole === 'VEHICLE') {
          role = 'VEHICLE';
        }

        return { userId, role, username };
      } catch {
        // Invalid token -> treat as viewer
        return { userId: null, role: 'VIEWER', username: null };
      }
    }

    // No auth -> viewer
    return { userId: null, role: 'VIEWER', username: null };
  }

  private async getPeerAndChannel(
    client: Socket,
    overrideChannel?: string,
  ): Promise<{ channelId: string; peer: any | null }> {
    const peer = this.mediasoup.findPeer(client.id);
    const channelId =
      overrideChannel || peer?.channelId || this.defaultChannel;
    return { channelId, peer };
  }

  private async pushStreamsList(channelId: string) {
    const all = await this.broadcast.listAllOnAirSources();
    this.server.to(channelId).emit('streams:list', all);
  }

  // ---------- Lifecycle ----------

  async handleConnection(client: Socket) {
    const { userId, role, username, vehicleKey } = this.extractAuth(client);

    if (vehicleKey && role !== 'VEHICLE') {
      client.disconnect();
      return;
    }

    const requestedChannel =
      typeof client.handshake.query?.channelId === 'string'
        ? (client.handshake.query.channelId as string)
        : null;

    const channelId = requestedChannel || this.defaultChannel;

    await this.mediasoup.joinRoom(client.id, {
      channelId,
      role,
      userId: userId ?? undefined,
      username: username ?? undefined,
      vehicleKey,
    });

    client.join(channelId);
    client.emit('ready', { role, channelId });
  }

  async handleDisconnect(client: Socket) {
    await this.mediasoup.leaveRoom(client.id);
    try {
      await this.broadcast.stopSocketStream(client.id);
    } catch {
      // ignore errors
    }
  }

  // ---------- Mediasoup signaling ----------

  @SubscribeMessage('getRouterRtpCapabilities')
  async onGetRouterRtpCapabilities(@ConnectedSocket() client: Socket) {
    const peer = this.mediasoup.findPeer(client.id);
    if (!peer) return;

    const room = await this.mediasoup.getOrCreateRoom(peer.channelId);
    client.emit('routerRtpCapabilities', room.router.rtpCapabilities);
  }

  @SubscribeMessage('createWebRtcTransport')
  async onCreateTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { direction: 'send' | 'recv' },
  ) {
    // Additional permission checks for send-direction are enforced in MediasoupService
    const transport = await this.mediasoup.createWebRtcTransport(
      client.id,
      {
        peerId: client.id,
        direction: body.direction,
      },
    );

    client.emit('transportCreated', {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  }

  @SubscribeMessage('connectWebRtcTransport')
  async onConnectTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { transportId: string; dtlsParameters: any },
  ) {
    await this.mediasoup.connectTransport(
      client.id,
      body.transportId,
      body.dtlsParameters,
    );
    client.emit('transportConnected', {
      transportId: body.transportId,
    });
  }

  @SubscribeMessage('produce')
  async onProduce(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      transportId: string;
      kind: 'audio' | 'video';
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
        .emit('newProducer', { producerId: producer.id, peerId: peer.id });
    }

    client.emit('produced', { producerId: producer.id });
  }

  @SubscribeMessage('consume')
  async onConsume(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { producerId: string; rtpCapabilities: any },
  ) {
    const { consumer, producerPeer } =
      await this.mediasoup.consume(
        client.id,
        body.producerId,
        body.rtpCapabilities,
      );

    client.emit('consumed', {
      producerId: body.producerId,
      id: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      peerId: producerPeer.id,
    });
  }

  // ---------- Application-level stream events ----------

  @SubscribeMessage('stream:start')
  async onStreamStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      channelId?: string;
      kind: 'camera' | 'screen';
      streamId?: string;
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

  @SubscribeMessage('stream:stop')
  async onStreamStop(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { channelId?: string; streamId?: string },
  ) {
    const { channelId } = await this.getPeerAndChannel(
      client,
      body.channelId,
    );

    await this.broadcast.stopSocketStream(
      client.id,
      body.streamId ?? null,
    );

    await this.pushStreamsList(channelId);
  }

  /**
   * Notify clients about join request status changes.
   * REST API is the source of truth; this only broadcasts updates.
   */
  @SubscribeMessage('join:notify')
  async onJoinNotify(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      toUserId: number;
      status: 'APPROVED' | 'REJECTED';
      intent: 'VIEW' | 'CAMERA' | 'SCREEN' | 'CONTROL';
      requestId?: string | number | null;
      message?: string | null;
    },
  ) {
    const { channelId } = await this.getPeerAndChannel(client);

    this.server.to(channelId).emit('join-requests:status', {
      toUserId: body.toUserId,
      status: body.status,
      intent: body.intent,
      requestId: body.requestId ?? null,
      message: body.message ?? null,
      at: Date.now(),
    });
  }

  /**
   * End broadcast for authorized roles.
   */
  @SubscribeMessage('broadcast:end')
  async onBroadcastEnd(@ConnectedSocket() client: Socket) {
    const { channelId, peer } = await this.getPeerAndChannel(client);
    if (!peer) return;

    if (
      !(
        peer.role === 'ADMIN' ||
        peer.role === 'BROADCAST_MANAGER' ||
        peer.role === 'VEHICLE'
      )
    ) {
      client.emit('permission:denied', {
        reason: 'not allowed to end broadcast',
      });
      return;
    }

    try {
      await this.broadcast.stopSocketStream(client.id);
      await this.pushStreamsList(channelId);
      client.emit('broadcast:ended', { ok: true, at: Date.now() });
    } catch {
      client.emit('broadcast:ended', { ok: false });
    }
  }
}
