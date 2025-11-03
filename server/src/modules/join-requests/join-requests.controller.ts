import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";
import { JoinRequestsService } from "./join-requests.service";
import { CreateJoinRequestDto } from "./dto/create-join-request.dto";

@Controller("join-requests")
@UseGuards(JwtAuthGuard)
export class JoinRequestsController {
  constructor(private readonly service: JoinRequestsService) {}

  @Post()
  async create(@Request() req, @Body() body: CreateJoinRequestDto) {
    const fromUserId = req.user.userId;
    return this.service.create(
      fromUserId,
      body.toUserId,
      body.message,
      body.intent ?? "VIEW",
    );
  }

  /**
   * ADMIN / BROADCAST_MANAGER → يشوف الطلبات اللي واصلة له
   * VIEWER → يشوف طلباته
   */
  @Get("my")
  async my(@Request() req) {
    const userId = req.user.userId;
    const role = req.user.role as UserRole;
    if (role === UserRole.ADMIN || role === UserRole.BROADCAST_MANAGER) {
      return this.service.listForOwner(userId);
    }
    return this.service.listMine(userId);
  }

  @Post(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async approve(@Request() req, @Param("id") id: string) {
    return this.service.approve(req.user.userId, Number(id));
  }

  @Post(":id/reject")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async reject(@Request() req, @Param("id") id: string) {
    return this.service.reject(req.user.userId, Number(id));
  }

  @Get("last/:ownerId")
  async last(@Request() req, @Param("ownerId") ownerId: string) {
    const viewerId = req.user.userId;
    return this.service.findLastForViewerAndOwner(viewerId, Number(ownerId));
  }
}
