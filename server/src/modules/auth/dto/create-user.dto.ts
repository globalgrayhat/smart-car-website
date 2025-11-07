import { IsEmail, IsString, MinLength, IsEnum } from "class-validator";
import { UserRole } from "../../users/user.entity";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}
