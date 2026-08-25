import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { AuditOutcome, MembershipRole, type PrismaClient } from "@prisma/client";
import { lastValueFrom, of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { Reflector } from "@nestjs/core";
import { PrivilegedMutationAuditInterceptor } from "./privileged-mutation-audit.interceptor";

function execution(method: string): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        route: { path: "/admin/resource/:resourceId" },
        params: { resourceId: "11111111-1111-4111-8111-111111111111" },
        body: { status: "SUSPENDED", password: "must-not-be-audited" },
        context: { requestId: "req-1", correlationId: "corr-1" },
        authContext: {
          userId: "22222222-2222-4222-8222-222222222222",
          organizationId: null,
          membershipId: "33333333-3333-4333-8333-333333333333",
          sessionId: "44444444-4444-4444-8444-444444444444",
          role: MembershipRole.SUPER_ADMIN,
          permissions: ["*"],
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("PrivilegedMutationAuditInterceptor", () => {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(false),
  } as unknown as Reflector;
  it("persists mandatory evidence before mutation and marks success without body values", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-id" });
    const update = vi.fn().mockResolvedValue({ id: "audit-id" });
    const prisma = { auditLog: { create, update } } as unknown as PrismaClient;
    const handler = { handle: vi.fn(() => of({ ok: true })) } as CallHandler;

    await expect(
      lastValueFrom(
        new PrivilegedMutationAuditInterceptor(prisma, reflector).intercept(
          execution("POST"),
          handler,
        ),
      ),
    ).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: AuditOutcome.ATTEMPTED,
        metadata: expect.objectContaining({ bodyFieldNames: ["password", "status"] }),
      }),
      select: { id: true },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain("must-not-be-audited");
    expect(update).toHaveBeenCalledWith({
      where: { id: "audit-id" },
      data: { outcome: AuditOutcome.SUCCEEDED },
    });
  });

  it("does not execute a privileged mutation when mandatory audit persistence fails", async () => {
    const prisma = {
      auditLog: { create: vi.fn().mockRejectedValue(new Error("audit unavailable")) },
    } as unknown as PrismaClient;
    const handler = { handle: vi.fn(() => of({ ok: true })) } as CallHandler;

    await expect(
      lastValueFrom(
        new PrivilegedMutationAuditInterceptor(prisma, reflector).intercept(
          execution("PUT"),
          handler,
        ),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MANDATORY_AUDIT_UNAVAILABLE" }),
    });
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it("does not make non-sensitive GET paths depend on audit persistence", async () => {
    const create = vi.fn();
    const prisma = { auditLog: { create } } as unknown as PrismaClient;
    const handler = { handle: vi.fn(() => of({ healthy: true })) } as CallHandler;

    await expect(
      lastValueFrom(
        new PrivilegedMutationAuditInterceptor(prisma, reflector).intercept(
          execution("GET"),
          handler,
        ),
      ),
    ).resolves.toEqual({ healthy: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("fails closed before a mandatory sensitive read when audit is unavailable", async () => {
    const sensitiveReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const prisma = {
      auditLog: { create: vi.fn().mockRejectedValue(new Error("audit unavailable")) },
    } as unknown as PrismaClient;
    const handler = { handle: vi.fn(() => of({ secret: true })) } as CallHandler;

    await expect(
      lastValueFrom(
        new PrivilegedMutationAuditInterceptor(prisma, sensitiveReflector).intercept(
          execution("GET"),
          handler,
        ),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MANDATORY_AUDIT_UNAVAILABLE" }),
    });
    expect(handler.handle).not.toHaveBeenCalled();
  });
});
