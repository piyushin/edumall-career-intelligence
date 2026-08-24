import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_PERMISSIONS_KEY } from "./auth.tokens";
import type { RequestWithAuth } from "./auth.types";

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(AUTH_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) {
      return true;
    }

    const auth = context.switchToHttp().getRequest<RequestWithAuth>().authContext;

    if (!auth) {
      throw new UnauthorizedException({
        code: "INVALID_SESSION",
        message: "Authentication required.",
      });
    }

    if (auth.role === "SUPER_ADMIN" && auth.organizationId === null) {
      return true;
    }

    // ORGANIZATION_SCOPED_SUPER_ADMIN_PERMISSION_BLOCK

    if (auth.role === "SUPER_ADMIN" && auth.organizationId !== null) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSION",

        message: "Platform permission requires platform scope.",
      });
    }

    const effective = new Set(auth.permissions ?? []);

    if (effective.has("*")) {
      return true;
    }

    const missing = required.filter((permission) => !effective.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSION",
        message: "Insufficient administrative permission.",
        required,
        missing,
      });
    }

    return true;
  }
}
