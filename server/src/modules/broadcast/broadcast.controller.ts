import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
} from "@nestjs/common";
import { BroadcastService } from "./broadcast.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";

@Controller("broadcast")
export class BroadcastController {
  constructor(private readonly service: BroadcastService) {}

  // Owner dashboard → list own sources
  @Get("me/sources")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async listMine(@Request() req) {
    return this.service.listSources(req.user.userId);
  }

  // Public list of all on-air sources (no auth)
  @Get("public")
  async listAllOnAir() {
    return this.service.listAllOnAirSources();
  }

  // Owner toggles a source on/off
  @Post("sources/:id/on-air")
  @UseGuards(JwtAuthGuard, RolesGuard)
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
}
