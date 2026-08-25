import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { MembershipRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "./auth.types";
import { ScopeGuard } from "./scope.guard";

function execution(organizationId: string | null): ExecutionContext {
  const authContext: AuthContext = {
    userId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    membershipId: "33333333-3333-4333-8333-333333333333",
    organizationId,
    role: MembershipRole.PLATFORM_ADMIN,
  };
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ authContext }) }),
  } as unknown as ExecutionContext;
}

describe("ScopeGuard", () => {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as unknown as Reflector;

  it("accepts platform scope", () => {
    expect(new ScopeGuard(reflector).canActivate(execution(null))).toBe(true);
  });

  it("prevents caller-controlled tenant scope expansion", () => {
    expect(() =>
      new ScopeGuard(reflector).canActivate(execution("44444444-4444-4444-8444-444444444444")),
    ).toThrow(/requires platform scope/);
  });
});
