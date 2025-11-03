import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "./user.entity";

class CreateUserDto {
  email: string;
  username: string;
  password: string;
  role: UserRole;
}

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  all() {
    return this.usersService.all();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(
      dto.email,
      dto.username,
      dto.password,
      dto.role,
    );
  }
}
