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

// Compatibility is deliberately finite: legacy organization administrators retain
// only the operational permissions exposed to them before delegated R19 roles.
// Catalogue/price mutation and payment approval are central platform operations
// (R20-C2): a tenant must never be able to price its own access to zero or mark
// its own orders as paid.
const LEGACY_ORGANIZATION_ADMIN_PERMISSIONS = new Set([
  "assessment.view",
  "assessment.manage",
  "assessment.publish",
  "candidate.view",
  "candidate.manage",
  "report.release",
  "report.search",
  "report.credit.view",
  "report.credit.manage",
  "counsellor.assignment.view",
  "counsellor.assignment.manage",
  "commerce.view",
  "commerce.coupon.manage",
]);

const LEGACY_COUNSELLOR_PERMISSIONS = new Set([
  "candidate.view",
  "report.release",
  "report.search",
  "counsellor.assignment.view",
]);

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

    if (auth.role === "ORGANIZATION_ADMIN" && auth.organizationId !== null) {
      for (const permission of LEGACY_ORGANIZATION_ADMIN_PERMISSIONS) {
        effective.add(permission);
      }
    }

    if (auth.role === "COUNSELLOR" && auth.organizationId !== null) {
      for (const permission of LEGACY_COUNSELLOR_PERMISSIONS) effective.add(permission);
    }

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
