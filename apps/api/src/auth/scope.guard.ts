import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_PLATFORM_SCOPE_KEY } from "./auth.tokens";
import type { RequestWithAuth } from "./auth.types";

@Injectable()
export class ScopeGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const platformOnly =
      this.reflector.getAllAndOverride<boolean>(AUTH_PLATFORM_SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (!platformOnly) return true;

    const auth = context.switchToHttp().getRequest<RequestWithAuth>().authContext;
    if (!auth) {
      throw new UnauthorizedException({
        code: "INVALID_SESSION",
        message: "Authentication required.",
      });
    }

    if (auth.organizationId !== null) {
      throw new ForbiddenException({
        code: "PLATFORM_SCOPE_REQUIRED",
        message: "This operation requires platform scope.",
      });
    }

    return true;
  }
}
