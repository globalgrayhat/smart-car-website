// backend/src/modules/join-requests/join-requests.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  JoinRequest,
  JoinRequestStatus,
} from "./join-request.entity";
import { UsersService } from "../users/users.service";
import { UserRole } from "../users/user.entity";

type JoinIntent = "VIEW" | "CAMERA" | "ROLE_UPGRADE";

@Injectable()
export class JoinRequestsService {
  constructor(
    @InjectRepository(JoinRequest)
    private readonly repo: Repository<JoinRequest>,
    private readonly usersService: UsersService,
  ) {}

  // helper: is this user already approved for this owner (any intent)?
  async hasApprovedBetween(
    fromUserId: number,
    toUserId: number,
  ): Promise<JoinRequest | null> {
    return this.repo.findOne({
      where: {
        fromUserId,
        toUserId,
        status: JoinRequestStatus.APPROVED,
      },
      order: { createdAt: "DESC" },
    });
  }

  // helper: does this user have any approved “can publish” request? (for mediasoup)
  async hasApprovedCameraOrUpgrade(viewerId: number): Promise<boolean> {
    const req = await this.repo.findOne({
      where: {
        fromUserId: viewerId,
        status: JoinRequestStatus.APPROVED,
      },
      order: { createdAt: "DESC" },
    });
    if (!req) return false;
    return req.intent === "CAMERA" || req.intent === "ROLE_UPGRADE";
  }

  async create(
    fromUserId: number,
    toUserId: number,
    message?: string | null,
    intent: JoinIntent = "VIEW",
  ) {
    // 1) ممنوع ترسل لنفسك
    if (fromUserId === toUserId) {
      throw new ForbiddenException("لا يمكن إرسال طلب إلى نفس الحساب.");
    }

    // 2) لو فيه موافقة سابقة لنفس المالك → لا تنشئ جديد
    const approved = await this.hasApprovedBetween(fromUserId, toUserId);
    if (approved) {
      // لو كان approved بكاميرا أو ترقية → يعتبر أعلى من VIEW
      // نرجعه نفسه
      return approved;
    }

    // 3) لا تنشئ طلبين معلّقين لنفس الزوج
    const exists = await this.repo.findOne({
      where: {
        fromUserId,
        toUserId,
        status: JoinRequestStatus.PENDING,
      },
    });
    if (exists) return exists;

    // 4) أنشئ
    const entity = this.repo.create({
      fromUserId,
      toUserId,
      message: message ?? null,
      status: JoinRequestStatus.PENDING,
      intent,
    });
    return this.repo.save(entity);
  }

  async listForOwner(ownerId: number) {
    return this.repo.find({
      where: { toUserId: ownerId },
      order: { createdAt: "DESC" },
    });
  }

  async listMine(viewerId: number) {
    return this.repo.find({
      where: { fromUserId: viewerId },
      order: { createdAt: "DESC" },
      take: 20,
    });
  }

  async approve(ownerId: number, id: number) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException("Join request not found");
    if (req.toUserId !== ownerId)
      throw new ForbiddenException("You are not allowed to approve this request");

    req.status = JoinRequestStatus.APPROVED;

    // ROLE_UPGRADE → فعلياً نرفعه
    if (req.intent === "ROLE_UPGRADE") {
      req.grantedRole = UserRole.BROADCAST_MANAGER;
      await this.repo.save(req);

      const viewer = await this.usersService.findById(req.fromUserId);
      if (viewer && viewer.role === UserRole.VIEWER) {
        await this.usersService.updateRole(
          viewer.id,
          UserRole.BROADCAST_MANAGER,
        );
      }
      return req;
    }

    // VIEW / CAMERA → مجرد موافقة
    req.grantedRole = null;
    return this.repo.save(req);
  }

  async reject(ownerId: number, id: number) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException("Join request not found");
    if (req.toUserId !== ownerId)
      throw new ForbiddenException("You are not allowed to reject this request");
    req.status = JoinRequestStatus.REJECTED;
    return this.repo.save(req);
  }

  async findLastForViewerAndOwner(viewerId: number, ownerId: number) {
    return this.repo.findOne({
      where: { fromUserId: viewerId, toUserId: ownerId },
      order: { createdAt: "DESC" },
    });
  }
}
