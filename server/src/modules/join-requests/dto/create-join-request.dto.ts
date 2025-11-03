import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsIn,
} from "class-validator";

export class CreateJoinRequestDto {
  @IsInt()
  @Min(1)
  toUserId: number;

  @IsOptional()
  @IsString()
  message?: string;

  // VIEW → طلب مشاهدة
  // CAMERA → يبي يفتح كاميرته
  // ROLE_UPGRADE → يبي يترقّى
  @IsOptional()
  @IsString()
  @IsIn(["VIEW", "CAMERA", "ROLE_UPGRADE"])
  intent?: "VIEW" | "CAMERA" | "ROLE_UPGRADE";
}
