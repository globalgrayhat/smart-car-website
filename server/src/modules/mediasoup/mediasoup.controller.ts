// src/modules/mediasoup/mediasoup.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
} from "@nestjs/common";
import { MediasoupService } from "./mediasoup.service";
import { JwtAuthGuard } from "../auth/jwt.guard"; // adjust path
import { RolesGuard } from "../auth/roles.guard"; // adjust path
import { Roles } from "../auth/roles.decorator"; // adjust path
import { UserRole } from "../users/user.entity"; // adjust path

@Controller("mediasoup")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediasoupController {
  constructor(private readonly mediasoup: MediasoupService) {}

  /**
   * Admin can list all active rooms + peers
   */
  @Get("rooms")
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  listRooms() {
    return this.mediasoup.listRooms();
  }

  /**
   * Admin can register a vehicle API key (in-memory).
   * In real project → store in DB.
   */
  @Post("vehicles/register")
  @Roles(UserRole.ADMIN)
  registerVehicle(@Body() body: { key: string; label?: string }) {
    // simple in-memory for now
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = (this.mediasoup as any);
    if (!m["vehicleKeys"]) {
      m["vehicleKeys"] = new Map<string, string>();
    }
    m["vehicleKeys"].set(body.key, body.label || "vehicle");
    return { ok: true };
  }

  /**
   * Admin can kick a peer from a room
   */
  @Post("rooms/:roomId/kick/:peerId")
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async kick(@Param("peerId") peerId: string) {
    await this.mediasoup.leaveRoom(peerId);
    return { ok: true };
  }
}
