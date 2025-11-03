import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { BroadcastModule } from "./modules/broadcast/broadcast.module";
import { VehiclesModule } from "./modules/vehicles/vehicles.module";
import { JoinRequestsModule } from "./modules/join-requests/join-requests.module";
import { MediasoupModule } from "./modules/mediasoup/mediasoup.module";

import { User } from "./modules/users/user.entity";
import { BroadcastSession } from "./modules/broadcast/entities/broadcast-session.entity";
import { BroadcastSource } from "./modules/broadcast/entities/broadcast-source.entity";
import { BroadcastInvite } from "./modules/broadcast/entities/broadcast-invite.entity";
import { Vehicle } from "./modules/vehicles/vehicle.entity";
import { JoinRequest } from "./modules/join-requests/join-request.entity";

@Module({
  imports: [
    // global config (reads from .env but via ConfigService)
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // DB connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "mysql",
        host: config.get<string>("DB_HOST", "localhost"),
        port: parseInt(config.get<string>("DB_PORT", "3306"), 10),
        username: config.get<string>("DB_USER", "root"),
        password: config.get<string>("DB_PASS", ""),
        database: config.get<string>("DB_NAME", "smartcar"),
        entities: [
          User,
          BroadcastSession,
          BroadcastSource,
          BroadcastInvite,
          Vehicle,
          JoinRequest,
        ],
        synchronize: true, // ⚠️ close in production
      }),
    }),

    // feature modules
    AuthModule,
    UsersModule,
    BroadcastModule,
    VehiclesModule,
    JoinRequestsModule,
    MediasoupModule,
  ],
})
export class AppModule {}
