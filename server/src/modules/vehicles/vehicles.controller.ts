import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";

@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async list(@Request() req) {
    return this.service.listForUser(req.user.userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async create(@Request() req, @Body() body: { name: string }) {
    return this.service.registerVehicle(req.user.userId, body.name);
  }

  // Vehicle heartbeat (no JWT, uses API key)
  @Post("heartbeat")
  async heartbeat(@Body() body: { apiKey: string }) {
    const v = await this.service.heartbeat(body.apiKey);
    return { ok: !!v };
  }
}
