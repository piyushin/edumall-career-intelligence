import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { MembershipRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "./auth.types";
import { RolesGuard } from "./roles.guard";

const authContext: AuthContext = {
  membershipId: "33333333-3333-4333-8333-333333333333",
  organizationId: "22222222-2222-4222-8222-222222222222",
  role: MembershipRole.ORGANIZATION_ADMIN,
  sessionId: "44444444-4444-4444-8444-444444444444",
  userId: "11111111-1111-4111-8111-111111111111",
};

function executionContext(auth?: AuthContext): ExecutionContext {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ authContext: auth }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows an authenticated role listed by the endpoint", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([MembershipRole.ORGANIZATION_ADMIN]),
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(executionContext(authContext))).toBe(true);
  });

  it("denies an authenticated role not listed by the endpoint", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([MembershipRole.SUPER_ADMIN]),
    } as unknown as Reflector;

    expect(() => new RolesGuard(reflector).canActivate(executionContext(authContext))).toThrow(
      /Insufficient role/,
    );
  });

  it("does not treat an organization-scoped SUPER_ADMIN role as platform authorization", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([MembershipRole.SUPER_ADMIN]),
    } as unknown as Reflector;
    const organizationSuperAdmin = {
      ...authContext,
      role: MembershipRole.SUPER_ADMIN,
    };

    expect(() =>
      new RolesGuard(reflector).canActivate(executionContext(organizationSuperAdmin)),
    ).toThrow(/Insufficient role/);
  });

  it("allows a Phase 1B-validated platform SUPER_ADMIN context", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([MembershipRole.SUPER_ADMIN]),
    } as unknown as Reflector;
    const platformSuperAdmin = {
      ...authContext,
      organizationId: null,
      role: MembershipRole.SUPER_ADMIN,
    };

    expect(new RolesGuard(reflector).canActivate(executionContext(platformSuperAdmin))).toBe(true);
  });

  it("requires authentication when role metadata is present", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([MembershipRole.ORGANIZATION_ADMIN]),
    } as unknown as Reflector;

    expect(() => new RolesGuard(reflector).canActivate(executionContext())).toThrow(
      /Authentication required/,
    );
  });

  it("does not restrict endpoints without role metadata", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(executionContext())).toBe(true);
  });
});
