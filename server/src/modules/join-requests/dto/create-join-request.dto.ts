// server/src/modules/join-requests/dto/create-join-request.dto.ts
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { JoinRequestIntent } from '../join-request.entity';

export class CreateJoinRequestDto {
  @IsInt()
  toUserId: number;

  @IsEnum(JoinRequestIntent)
  intent: JoinRequestIntent;

  @IsOptional()
  @IsString()
  message?: string;
}
