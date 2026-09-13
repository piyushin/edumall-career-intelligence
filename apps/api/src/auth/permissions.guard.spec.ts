import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { MembershipRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "./auth.types";
import { PermissionsGuard } from "./permissions.guard";

const base: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  organizationId: null,
  role: MembershipRole.PLATFORM_ADMIN,
};

function context(auth?: AuthContext): ExecutionContext {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({ getRequest: () => ({ authContext: auth }) }),
  } as unknown as ExecutionContext;
}

function guard(required: string[]) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe("PermissionsGuard R19.1A", () => {
  it("allows PLATFORM SUPER_ADMIN wildcard", () => {
    expect(
      guard(["platform.settings.manage"]).canActivate(
        context({ ...base, role: MembershipRole.SUPER_ADMIN, permissions: ["*"] }),
      ),
    ).toBe(true);
  });

  it("denies an organization-scoped SUPER_ADMIN wildcard", () => {
    expect(() =>
      guard(["assessment.manage"]).canActivate(
        context({
          ...base,
          organizationId: "44444444-4444-4444-8444-444444444444",
          role: MembershipRole.SUPER_ADMIN,
          permissions: ["*"],
        }),
      ),
    ).toThrow(/Platform permission requires platform scope/);
  });

  it("allows a PLATFORM_ADMIN only through effective permissions", () => {
    expect(
      guard(["audit.view"]).canActivate(context({ ...base, permissions: ["audit.view"] })),
    ).toBe(true);
    expect(() =>
      guard(["admin.suspend"]).canActivate(context({ ...base, permissions: ["audit.view"] })),
    ).toThrow(/Insufficient administrative permission/);
  });

  it("preserves the finite legacy organization-admin permission matrix", () => {
    const auth = {
      ...base,
      organizationId: "44444444-4444-4444-8444-444444444444",
      role: MembershipRole.ORGANIZATION_ADMIN,
    };
    expect(guard(["assessment.manage"]).canActivate(context(auth))).toBe(true);
    expect(() => guard(["admin.create"]).canActivate(context(auth))).toThrow(
      /Insufficient administrative permission/,
    );
  });

  it("keeps catalogue pricing and payment approval central-only for legacy tenant admins", () => {
    const auth = {
      ...base,
      organizationId: "44444444-4444-4444-8444-444444444444",
      role: MembershipRole.ORGANIZATION_ADMIN,
    };
    expect(guard(["commerce.view"]).canActivate(context(auth))).toBe(true);
    expect(guard(["commerce.coupon.manage"]).canActivate(context(auth))).toBe(true);
    for (const permission of [
      "commerce.product.manage",
      "commerce.price.manage",
      "commerce.payment.approve",
    ]) {
      expect(() => guard([permission]).canActivate(context(auth)), permission).toThrow(
        /Insufficient administrative permission/,
      );
    }
  });
});
