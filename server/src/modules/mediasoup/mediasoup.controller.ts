import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MediasoupService } from './mediasoup.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('mediasoup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediasoupController {
  constructor(private readonly mediasoup: MediasoupService) {}

  /**
   * List all active rooms and peers.
   * Restricted to admins and broadcast managers.
   */
  @Get('rooms')
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  listRooms() {
    return this.mediasoup.listRooms();
  }

  /**
   * Force a peer to leave a room.
   * Restricted to admins and broadcast managers.
   */
  @Post('rooms/:roomId/kick/:peerId')
  @Roles(UserRole.ADMIN, UserRole.BROADCAST_MANAGER)
  async kick(@Param('peerId') peerId: string) {
    await this.mediasoup.leaveRoom(peerId);
    return { ok: true };
  }
}
