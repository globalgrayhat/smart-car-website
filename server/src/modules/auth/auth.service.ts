import { Injectable, BadRequestException } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { User, UserRole } from "../users/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);
    if (!isPasswordValid) return null;

    return user;
  }

  private getPermissions(role: UserRole) {
    switch (role) {
      case UserRole.ADMIN:
        return ["*"];
      case UserRole.BROADCAST_MANAGER:
        return ["broadcast:*", "vehicle:*", "mediasoup:*"];
      case UserRole.VIEWER:
        return ["view:*"];
      default:
        return [];
    }
  }

  async login(user: User) {
    const payload = {
      sub: user.id,
      role: user.role,
      perms: this.getPermissions(user.role),
      username: user.username,
      email: user.email,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(dto: CreateUserDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException("Email already exists");
    }

    const newUser = await this.usersService.createUser(
      dto.email,
      dto.username,
      dto.password,
      dto.role,
    );

    return this.login(newUser);
  }
}
