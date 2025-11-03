import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JoinRequest } from "./join-request.entity";
import { JoinRequestsService } from "./join-requests.service";
import { JoinRequestsController } from "./join-requests.controller";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [TypeOrmModule.forFeature([JoinRequest]), UsersModule],
  providers: [JoinRequestsService],
  controllers: [JoinRequestsController],
  exports: [JoinRequestsService],
})
export class JoinRequestsModule {}
