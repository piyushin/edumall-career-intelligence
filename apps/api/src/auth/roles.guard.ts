import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { MembershipRole } from "@prisma/client";
import { AUTH_ROLES_KEY } from "./auth.tokens";
import type { RequestWithAuth } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const roles =
      this.reflector.getAllAndOverride<MembershipRole[]>(AUTH_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (roles.length === 0) {
      return true;
    }

    const auth = context.switchToHttp().getRequest<RequestWithAuth>().authContext;
    if (!auth) {
      throw new UnauthorizedException({
        code: "INVALID_SESSION",
        message: "Authentication required.",
      });
    }

    const isOrganizationScopedSuperAdmin =
      auth.role === "SUPER_ADMIN" && auth.organizationId !== null;

    if (!roles.includes(auth.role) || isOrganizationScopedSuperAdmin) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Insufficient role.",
      });
    }

    return true;
  }
}
