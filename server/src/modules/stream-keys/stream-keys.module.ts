// backend/src/stream-keys/stream-keys.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamKey } from './stream-key.entity';
import { StreamKeysService } from './stream-keys.service';
import { StreamKeysController } from './stream-keys.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StreamKey])],
  providers: [StreamKeysService],
  controllers: [StreamKeysController],
  exports: [StreamKeysService],
})
export class StreamKeysModule {}
