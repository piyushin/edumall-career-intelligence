import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { APP_CONFIG } from "../config/app-config.token";
import { authenticationHttpError } from "./auth-http";
import { AuthService } from "./auth.service";
import type { RequestWithAuth } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = request.cookies?.[this.config.authCookieName];

    if (!token) {
      throw new UnauthorizedException({
        code: "INVALID_SESSION",
        message: "Authentication required.",
      });
    }

    try {
      request.authContext = await this.auth.validateSession(token);
      return true;
    } catch (error) {
      throw authenticationHttpError(error, "session");
    }
  }
}
