// server/src/modules/stream-keys/stream-keys.controller.ts

import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { StreamKeysService } from './stream-keys.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('stream-keys') // بدون api لأن غالباً عندك global prefix /api
@UseGuards(JwtAuthGuard)
export class StreamKeysController {
  constructor(private readonly service: StreamKeysService) {}

  @Get()
  async list(@Req() req) {
    const userId: number | undefined = req.user?.userId;
    return this.service.listForUser(userId!);
  }

  @Post()
  async create(@Req() req) {
    const userId: number | undefined = req.user?.userId;
    const sk = await this.service.createForUser(userId!);
    return { id: sk.id, key: sk.key, createdAt: sk.createdAt };
  }
}
