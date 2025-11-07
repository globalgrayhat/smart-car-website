// server/src/modules/broadcast/broadcast.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  BroadcastSession,
  BroadcastSessionStatus,
} from "./entities/broadcast-session.entity";
import {
  BroadcastSource,
  BroadcastSourceType,
} from "./entities/broadcast-source.entity";

function mergeMeta(existing: string | null, extra: any): string {
  try {
    const base = existing ? JSON.parse(existing) : {};
    return JSON.stringify({ ...base, ...extra });
  } catch {
    return JSON.stringify(extra);
  }
}

@Injectable()
export class BroadcastService {
  constructor(
    @InjectRepository(BroadcastSession)
    private readonly sessionsRepo: Repository<BroadcastSession>,
    @InjectRepository(BroadcastSource)
    private readonly sourcesRepo: Repository<BroadcastSource>,
  ) {}

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

  async listSources(userId: number) {
    const sess = await this.getOrCreateDefaultSession(userId);
    return this.sourcesRepo.find({
      where: { sessionId: sess.id },
      order: { id: "ASC" },
    });
  }

  // ✅ هذا هو المصدر الذي يستهلكه الفرونت: BroadcastSources
  async listAllOnAirSources() {
    const list = await this.sourcesRepo.find({
      where: { isOnAir: true },
      relations: ["session"],
      order: { id: "DESC" },
    });

    return list.map((s) => ({
      id: s.id,
      title: s.name,
      kind: s.type, // SCREEN | HOST_CAMERA | CAR_CAMERA | GUEST_CAMERA
      onAir: s.isOnAir,
      externalId: s.externalId,
      ownerUserId: s.session ? s.session.ownerUserId : null,
      ownerSocketId: s.ownerSocketId,
      meta: s.meta ? safeParseJson(s.meta) : null,
    }));
  }

  // ------- Mediasoup integration: upsert by producer --------

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

  // ------- Socket-based screen/camera placeholders ----------

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

    const mappedType =
      payload.kind === "screen"
        ? BroadcastSourceType.SCREEN
        : BroadcastSourceType.HOST_CAMERA;

    let src: BroadcastSource | null = null;

    if (payload.streamId) {
      src = await this.sourcesRepo.findOne({
        where: { externalId: payload.streamId },
      });
    }

    if (!src) {
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
        meta: JSON.stringify({
          channelId: payload.channelId,
          via: "SOCKET",
        }),
      });
    } else {
      src.isOnAir = payload.onAir ?? true;
      src.ownerSocketId = payload.socketId;
      src.externalId = payload.streamId ?? src.externalId;
      src.name = payload.name || src.name;
      src.meta = mergeMeta(src.meta, {
        channelId: payload.channelId,
        via: "SOCKET",
      });
    }

    return this.sourcesRepo.save(src);
  }

  async stopSocketStream(socketId: string, streamId: string | null = null) {
    if (streamId) {
      const s = await this.sourcesRepo.findOne({
        where: { externalId: streamId },
      });
      if (s) {
        s.isOnAir = false;
        return this.sourcesRepo.save(s);
      }
    }

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
}

function safeParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
