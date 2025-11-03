import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./local.guard";
import { CreateUserDto } from "./dto/create-user.dto";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post("login")
  async login(@Request() req) {
    return this.auth.login(req.user);
  }

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    return this.auth.register(createUserDto);
  }
}
