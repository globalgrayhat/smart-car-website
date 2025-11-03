// backend/src/modules/mediasoup/mediasoup.module.ts
import { Module } from "@nestjs/common";
import { MediasoupService } from "./mediasoup.service";
import { MediasoupGateway } from "./mediasoup.gateway";
import { MediasoupController } from "./mediasoup.controller";
import mediasoupConfig from "./mediasoup.config";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { BroadcastModule } from "../broadcast/broadcast.module";
import { JoinRequestsModule } from "../join-requests/join-requests.module";

@Module({
  imports: [
    ConfigModule.forFeature(mediasoupConfig),
    JwtModule.register({}),
    BroadcastModule,
    JoinRequestsModule, 
  ],
  providers: [MediasoupService, MediasoupGateway],
  controllers: [MediasoupController],
  exports: [MediasoupService],
})
export class MediasoupModule {}
