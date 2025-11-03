import { Strategy } from "passport-local";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

// LocalStrategy defines how the "local" authentication process works (email & password login).
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    // Configure passport-local to use "email" instead of the default "username" field.
    super({ usernameField: "email" });
  }

  // The validate() method is automatically called by Passport when the guard is triggered.
  // It checks whether the provided email and password are valid.
  async validate(email: string, password: string) {
    // Ask AuthService to validate the user credentials.
    const user = await this.auth.validateUser(email, password);

    // If no user is found or the password is incorrect, throw an Unauthorized exception.
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // If validation succeeds, return the user object (it will be attached to req.user).
    return user;
  }
}
