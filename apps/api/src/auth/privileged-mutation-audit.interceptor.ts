import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuditOutcome, type PrismaClient } from "@prisma/client";
import type { Request } from "express";
import { catchError, from, map, mergeMap, of, throwError, type Observable } from "rxjs";
import type { RequestWithContext } from "../common/middleware/request-context.middleware";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { RequestWithAuth } from "./auth.types";
import { AUTH_SENSITIVE_READ_KEY } from "./auth.tokens";

type PrivilegedRequest = Request & RequestWithAuth & RequestWithContext;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PrivilegedMutationAuditInterceptor implements NestInterceptor {
  public constructor(
    @Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<PrivilegedRequest>();
    const sensitiveRead =
      this.reflector.getAllAndOverride<boolean>(AUTH_SENSITIVE_READ_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    if (SAFE_METHODS.has(request.method.toUpperCase()) && !sensitiveRead) return next.handle();

    const auth = request.authContext;
    if (!auth) return next.handle(); // AuthGuard remains authoritative and runs before interceptors.

    const paramValues = Object.values(request.params ?? {}).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    );
    const entityId = paramValues.find((value) => UUID.test(value)) ?? null;
    const action = `privileged.http.${request.method.toLowerCase()}`;

    return from(
      this.prisma.auditLog.create({
        data: {
          actorUserId: auth.userId,
          organizationId: auth.organizationId,
          action,
          entityType: request.route?.path ? String(request.route.path) : "PrivilegedOperation",
          entityId,
          requestId: request.context?.requestId ?? null,
          correlationId: request.context?.correlationId ?? null,
          purpose: "privileged_administration",
          outcome: AuditOutcome.ATTEMPTED,
          metadata: {
            authorizedScope: auth.organizationId ? "ORGANIZATION" : "PLATFORM",
            role: auth.role,
            permissionCount: auth.permissions?.length ?? 0,
            bodyFieldNames: Object.keys(
              typeof request.body === "object" && request.body !== null ? request.body : {},
            ).sort(),
          },
        },
        select: { id: true },
      }),
    ).pipe(
      catchError(() =>
        throwError(
          () =>
            new ServiceUnavailableException({
              code: "MANDATORY_AUDIT_UNAVAILABLE",
              message: "Privileged audit evidence could not be persisted.",
            }),
        ),
      ),
      mergeMap((audit) =>
        next.handle().pipe(
          mergeMap((value) =>
            from(
              this.prisma.auditLog.update({
                where: { id: audit.id },
                data: { outcome: AuditOutcome.SUCCEEDED },
              }),
            ).pipe(
              map(() => value),
              // The durable ATTEMPTED row remains evidence if outcome enrichment fails
              // after the business mutation has already completed.
              catchError(() => of(value)),
            ),
          ),
          catchError((error: unknown) =>
            from(
              this.prisma.auditLog.update({
                where: { id: audit.id },
                data: { outcome: AuditOutcome.FAILED },
              }),
            ).pipe(
              catchError(() => of(null)),
              mergeMap(() => throwError(() => error)),
            ),
          ),
        ),
      ),
    );
  }
}
