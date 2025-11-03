// backend/src/modules/broadcast/broadcast.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { BroadcastService } from "./broadcast.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";
import { JoinRequestsService } from "../join-requests/join-requests.service";

@Controller("broadcast")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BroadcastController {
  constructor(
    private readonly service: BroadcastService,
    private readonly joins: JoinRequestsService,
  ) {}

  // GET /api/broadcast/me/sources
  @Get("me/sources")
  async listMine(@Request() req) {
    return this.service.listSources(req.user.userId);
  }

  // GET /api/broadcast/public
  @Get("public")
  async listAllOnAir() {
    return this.service.listAllOnAirSources();
  }

  // للتوافق القديم
  @Get("all-sources")
  async listAllOnAirOld() {
    return this.service.listAllOnAirSources();
  }

  // owner toggle
  @Post("sources/:id/on-air")
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async setOnAir(
    @Request() req,
    @Param("id") id: string,
    @Body() body: { isOnAir: boolean },
  ) {
    return this.service.setOnAir(
      req.user.userId,
      Number(id),
      body.isOnAir === true,
    );
  }

  // viewer → request view
  @Post("request/view")
  async requestView(
    @Request() req,
    @Body() body: { toUserId: number; message?: string },
  ) {
    const from = req.user.userId;
    if (from === body.toUserId) {
      throw new ForbiddenException("لا يمكن إرسال طلب مشاهدة لنفس الحساب.");
    }
    return this.joins.create(from, body.toUserId, body.message, "VIEW");
  }

  // viewer → request camera
  @Post("request/camera")
  async requestCamera(
    @Request() req,
    @Body() body: { toUserId: number; message?: string },
  ) {
    const from = req.user.userId;
    if (from === body.toUserId) {
      throw new ForbiddenException("لا يمكن إرسال طلب كاميرا لنفس الحساب.");
    }
    return this.joins.create(from, body.toUserId, body.message, "CAMERA");
  }

  // viewer → request role-upgrade
  @Post("request/role-upgrade")
  async requestRoleUpgrade(
    @Request() req,
    @Body() body: { toUserId: number; message?: string },
  ) {
    const from = req.user.userId;
    if (from === body.toUserId) {
      throw new ForbiddenException("لا يمكن إرسال طلب ترقية لنفس الحساب.");
    }
    return this.joins.create(
      from,
      body.toUserId,
      body.message,
      "ROLE_UPGRADE",
    );
  }
}
