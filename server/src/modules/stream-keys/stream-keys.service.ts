import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamKey } from './stream-key.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class StreamKeysService {
  constructor(
    @InjectRepository(StreamKey)
    private readonly repo: Repository<StreamKey>,
  ) {}

  async createForUser(userId: number) {
    const key = randomBytes(24).toString('hex');
    const sk = this.repo.create({ userId, key, active: true });
    await this.repo.save(sk);
    return sk;
  }

  async listForUser(userId: number) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async validate(key: string) {
    return this.repo.findOne({ where: { key, active: true } });
  }
}
