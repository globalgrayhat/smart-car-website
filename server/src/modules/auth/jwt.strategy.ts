import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "smartcar-secret"),
    });
  }

  async validate(payload: any) {
    // This object will be attached to req.user
    return {
      userId: payload.sub,
      role: payload.role,
      perms: payload.perms ?? [],
      username: payload.username,
      email: payload.email,
    };
  }
}
