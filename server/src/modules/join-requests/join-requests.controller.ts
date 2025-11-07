import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JoinRequestsService } from './join-requests.service';
import { JoinIntent } from './join-request.entity';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('join-requests')
@UseGuards(JwtAuthGuard)
export class JoinRequestsController {
  constructor(private readonly service: JoinRequestsService) {}

  /**
   * Create a new join request from the current user to a target owner.
   */
  @Post()
  async create(@Req() req, @Body() body: CreateJoinRequestDto) {
    const fromUserId: number | undefined = req.user?.userId;
    if (!fromUserId) {
      throw new BadRequestException('Missing authenticated user');
    }

    const toUserId = Number(body.toUserId);
    const intent = body.intent as JoinIntent;
    const message = body.message || null;

    const allowed: JoinIntent[] = ['VIEW', 'CAMERA', 'SCREEN', 'CONTROL'];
    if (!allowed.includes(intent)) {
      throw new BadRequestException('Invalid join intent');
    }

    const jr = await this.service.create(fromUserId, toUserId, intent, message);

    return {
      id: jr.id,
      intent: jr.intent,
      status: jr.status,
    };
  }

  /**
   * Get join requests addressed to the current user (broadcast owner).
   */
  @Get('my')
  async my(@Req() req) {
    const ownerId: number | undefined = req.user?.userId;
    if (!ownerId) {
      throw new BadRequestException('Missing authenticated user');
    }
    return this.service.getForOwner(ownerId);
  }

  /**
   * Get the last join request (any intent) between current user and a specific owner.
   */
  @Get('last/:ownerId')
  async last(
    @Req() req,
    @Param('ownerId', ParseIntPipe) ownerId: number,
  ) {
    const fromUserId: number | undefined = req.user?.userId;
    if (!fromUserId) {
      throw new BadRequestException('Missing authenticated user');
    }

    const jr = await this.service.getLastForPair(fromUserId, ownerId);

    if (!jr) {
      return { status: 'NONE' };
    }

    return {
      id: jr.id,
      intent: jr.intent,
      status: jr.status,
    };
  }

  /**
   * Approve a join request. Only the target owner can approve.
   */
  @Post(':id/approve')
  async approve(@Req() req, @Param('id', ParseIntPipe) id: number) {
    const ownerId: number | undefined = req.user?.userId;
    if (!ownerId) {
      throw new BadRequestException('Missing authenticated user');
    }
    const jr = await this.service.setStatus(id, ownerId, 'APPROVED');
    return { id: jr.id, status: jr.status };
  }

  /**
   * Reject a join request. Only the target owner can reject.
   */
  @Post(':id/reject')
  async reject(@Req() req, @Param('id', ParseIntPipe) id: number) {
    const ownerId: number | undefined = req.user?.userId;
    if (!ownerId) {
      throw new BadRequestException('Missing authenticated user');
    }
    const jr = await this.service.setStatus(id, ownerId, 'REJECTED');
    return { id: jr.id, status: jr.status };
  }
}
