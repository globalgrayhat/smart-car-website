import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./local.guard";
import { CreateUserDto } from "./dto/create-user.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post("login")
  async login(@Request() req) {
    // Returns access_token and basic user info
    return this.auth.login(req.user);
  }

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    // Admin can create accounts from users module; this is public register
    return this.auth.register(createUserDto);
  }
}
