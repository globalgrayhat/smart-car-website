import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import { BroadcastSession } from "./entities/broadcast-session.entity";
import { BroadcastSource } from "./entities/broadcast-source.entity";
import { BroadcastInvite } from "./entities/broadcast-invite.entity";
import { JoinRequestsModule } from "../join-requests/join-requests.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BroadcastSession,
      BroadcastSource,
      BroadcastInvite,
    ]),
    JoinRequestsModule,
  ],
  controllers: [BroadcastController],
  providers: [BroadcastService],
  exports: [BroadcastService],
})
export class BroadcastModule {}
