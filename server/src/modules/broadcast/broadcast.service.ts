import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  BroadcastSession,
  BroadcastSessionStatus,
} from "./entities/broadcast-session.entity";
import {
  BroadcastSource,
  BroadcastSourceType,
} from "./entities/broadcast-source.entity";
import {
  BroadcastInvite,
  InviteStatus,
} from "./entities/broadcast-invite.entity";
import { JoinRequestsService } from "../join-requests/join-requests.service";

/**
 * BroadcastService
 * - owns sessions per user
 * - owns sources per session
 * - can reflect mediasoup producers → DB
 * - can reflect raw socket signals (stream:start / stop) → DB
 * - provides list APIs for REST layer (/broadcast/sources, /broadcast/all-sources)
 */
@Injectable()
export class BroadcastService {
  constructor(
    @InjectRepository(BroadcastSession)
    private readonly sessionsRepo: Repository<BroadcastSession>,
    @InjectRepository(BroadcastSource)
    private readonly sourcesRepo: Repository<BroadcastSource>,
    @InjectRepository(BroadcastInvite)
    private readonly invitesRepo: Repository<BroadcastInvite>,
    private readonly joinReq: JoinRequestsService,
  ) {}

  /**
   * get or create default session PER USER
   */
  async getOrCreateDefaultSession(userId: number) {
    let sess = await this.sessionsRepo.findOne({
      where: { ownerUserId: userId, status: BroadcastSessionStatus.ACTIVE },
    });
    if (!sess) {
      sess = this.sessionsRepo.create({
        ownerUserId: userId,
        title: "Default session",
      });
      sess = await this.sessionsRepo.save(sess);
    }
    return sess;
  }

  /**
   * OLD → list sources of current user (for his dashboard)
   */
  async listSources(userId: number) {
    const sess = await this.getOrCreateDefaultSession(userId);
    return this.sourcesRepo.find({
      where: { sessionId: sess.id },
      order: { id: "ASC" },
    });
  }

  /**
   * NEW → list all on-air sources for all users
   * frontend expects key = ownerId → we alias it here.
   */
  async listAllOnAirSources() {
    const list = await this.sourcesRepo.find({
      where: { isOnAir: true },
      relations: ["session"],
      order: { id: "DESC" },
    });

    return list.map((s) => ({
      id: s.id,
      title: s.name,
      kind: s.type,
      onAir: s.isOnAir,
      externalId: s.externalId,
      ownerId: s.session?.ownerUserId ?? null, // 👈 frontend wants ownerId
      ownerUserId: s.session?.ownerUserId ?? null,
      ownerSocketId: s.ownerSocketId,
    }));
  }

  // ---------------------------------------------------------------------------
  // from MEDIASOUP (produce)
  // ---------------------------------------------------------------------------

  /**
   * Called by MediasoupService when a producer is created/updated
   * payload.onAir must be respected → mediasoup producers are usually onAir=true
   */
  async upsertFromMediasoup(payload: {
    producerId: string;
    userId: number | null;
    socketId: string | null;
    kind: "audio" | "video" | "screen" | "camera" | "custom";
    onAir: boolean;
    name?: string | null;
  }) {
    const ownerUserId = payload.userId ?? 1;
    const session = await this.getOrCreateDefaultSession(ownerUserId);

    const mappedType: BroadcastSourceType =
      payload.kind === "screen"
        ? BroadcastSourceType.SCREEN
        : payload.kind === "video" || payload.kind === "camera"
          ? BroadcastSourceType.HOST_CAMERA
          : payload.kind === "custom"
            ? BroadcastSourceType.GUEST_CAMERA
            : BroadcastSourceType.GUEST_CAMERA;

    let src = await this.sourcesRepo.findOne({
      where: { externalId: payload.producerId },
    });

    if (!src) {
      src = this.sourcesRepo.create({
        sessionId: session.id,
        name: payload.name || payload.kind.toUpperCase(),
        type: mappedType,
        externalId: payload.producerId,
        ownerSocketId: payload.socketId,
        isOnAir: payload.onAir,
      });
    } else {
      src.ownerSocketId = payload.socketId;
      src.isOnAir = payload.onAir;
      if (payload.name) src.name = payload.name;
      src.type = mappedType;
    }

    return this.sourcesRepo.save(src);
  }

  // ---------------------------------------------------------------------------
  // from SOCKET-ONLY (stream:start / stream:stop)
  // frontend uses this when user shares screen via getDisplayMedia
  // or when we want REST to see it even if it wasn't a mediasoup producer.
  // ---------------------------------------------------------------------------

  /**
   * Upsert source based on raw socket signal.
   * Used by MediasoupGateway.onStreamStart / onStreamBroadcastStart
   */
  async upsertFromSocketStream(payload: {
    userId: number | null;
    socketId: string;
    channelId: string;
    kind: "camera" | "screen";
    streamId?: string | null;
    name?: string | null;
    onAir?: boolean;
  }) {
    const ownerUserId = payload.userId ?? 1;
    const session = await this.getOrCreateDefaultSession(ownerUserId);

    const mappedType: BroadcastSourceType =
      payload.kind === "screen"
        ? BroadcastSourceType.SCREEN
        : BroadcastSourceType.HOST_CAMERA;

    // we try to match either by externalId (streamId) or by socket-owner-session
    let src: BroadcastSource | null = null;

    if (payload.streamId) {
      src = await this.sourcesRepo.findOne({
        where: { externalId: payload.streamId },
      });
    }

    if (!src) {
      // fallback: same session + same socket + same type
      src = await this.sourcesRepo.findOne({
        where: {
          sessionId: session.id,
          ownerSocketId: payload.socketId,
          type: mappedType,
        },
      });
    }

    if (!src) {
      src = this.sourcesRepo.create({
        sessionId: session.id,
        name: payload.name || payload.kind.toUpperCase(),
        type: mappedType,
        externalId: payload.streamId ?? null,
        ownerSocketId: payload.socketId,
        isOnAir: payload.onAir ?? true,
        meta: {
          channelId: payload.channelId,
          via: "SOCKET",
        },
      });
    } else {
      src.isOnAir = payload.onAir ?? true;
      src.ownerSocketId = payload.socketId;
      src.externalId = payload.streamId ?? src.externalId;
      src.name = payload.name || src.name;
      src.meta = {
        ...(src.meta || {}),
        channelId: payload.channelId,
        via: "SOCKET",
      };
    }

    return this.sourcesRepo.save(src);
  }

  /**
   * stop a source that was created via socket (or mediasoup) for a given socket
   */
  async stopSocketStream(socketId: string, streamId: string | null = null) {
    // 1) by streamId
    if (streamId) {
      const s = await this.sourcesRepo.findOne({
        where: { externalId: streamId },
      });
      if (s) {
        s.isOnAir = false;
        return this.sourcesRepo.save(s);
      }
    }

    // 2) generic: all sources for that socket → off
    const list = await this.sourcesRepo.find({
      where: { ownerSocketId: socketId },
    });
    for (const s of list) {
      s.isOnAir = false;
      await this.sourcesRepo.save(s);
    }
    return { ok: true };
  }

  async removeByExternalId(externalId: string) {
    const src = await this.sourcesRepo.findOne({ where: { externalId } });
    if (!src) return { ok: true };
    await this.sourcesRepo.remove(src);
    return { ok: true };
  }

  /**
   * owner turn source on/off (REST)
   */
  async setOnAir(userId: number, sourceId: number, isOnAir: boolean) {
    const src = await this.sourcesRepo.findOne({
      where: { id: sourceId },
      relations: ["session"],
    });
    if (!src) throw new NotFoundException("Source not found");
    if (src.session.ownerUserId !== userId) {
      throw new ForbiddenException("Not your session");
    }
    src.isOnAir = isOnAir;
    return this.sourcesRepo.save(src);
  }

  /**
   * admin → send invite to another user to join session
   */
  async createInvite(
    sessionId: number,
    fromUserId: number,
    toUserId: number,
  ) {
    const inv = this.invitesRepo.create({
      sessionId,
      fromUserId,
      toUserId,
      token: Math.random().toString(36).slice(2),
      status: InviteStatus.PENDING,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    return this.invitesRepo.save(inv);
  }

  /**
   * legacy helper → list all CAMERA-ish sources
   */
  async listAllCameraSources() {
    const cameras = await this.sourcesRepo.find({
      where: {
        type: In([
          BroadcastSourceType.HOST_CAMERA,
          BroadcastSourceType.CAR_CAMERA,
          BroadcastSourceType.GUEST_CAMERA,
        ]),
      },
      relations: ["session"],
      order: { id: "ASC" },
    });

    return cameras.map((c) => ({
      ownerId: c.ownerSocketId,
      userId: c.session?.ownerUserId ?? null,
      label: c.name,
      streamId: c.externalId,
      onAir: c.isOnAir,
    }));
  }

  // ---------------------------------------------------------------------------
  // JOIN REQUESTS (VIEW / CAMERA / ROLE_UPGRADE)
  // ---------------------------------------------------------------------------

  async requestView(fromUserId: number, toUserId: number, msg?: string) {
    return this.joinReq.create(
      fromUserId,
      toUserId,
      msg ?? "REQUEST_VIEW",
      "VIEW",
    );
  }

  async requestCamera(fromUserId: number, toUserId: number, msg?: string) {
    return this.joinReq.create(
      fromUserId,
      toUserId,
      msg ?? "REQUEST_CAMERA",
      "CAMERA",
    );
  }

  async requestRoleUpgrade(
    fromUserId: number,
    toUserId: number,
    msg?: string,
  ) {
    return this.joinReq.create(
      fromUserId,
      toUserId,
      msg ?? "REQUEST_ROLE_UPGRADE",
      "ROLE_UPGRADE",
    );
  }
}
