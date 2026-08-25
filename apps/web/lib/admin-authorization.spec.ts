import { describe, expect, it } from "vitest";
import {
  canAccessGlobalRoute,
  hasPermission,
  isPlatformSession,
  safeNextPath,
} from "./admin-authorization";
import type { AuthSession, MembershipRole } from "./auth";

function session(
  role: MembershipRole,
  organizationId: string | null,
  permissions: string[] = [],
): AuthSession {
  return {
    session: {
      membershipId: "11111111-1111-4111-8111-111111111111",
      organizationId,
      role,
      userId: "22222222-2222-4222-8222-222222222222",
      permissions,
    },
    user: { email: "admin@example.com" },
  };
}

describe("Control Centre authorization projection", () => {
  it("allows the Platform Super Admin wildcard only at platform scope", () => {
    expect(hasPermission(session("SUPER_ADMIN", null), "admin.view")).toBe(true);
    expect(canAccessGlobalRoute(session("SUPER_ADMIN", null), "audit.view")).toBe(true);
    expect(canAccessGlobalRoute(session("SUPER_ADMIN", "tenant-id"), "audit.view")).toBe(false);
  });

  it("drives delegated Platform Admin navigation from effective permissions", () => {
    const delegated = session("PLATFORM_ADMIN", null, ["candidate.view", "audit.view"]);
    expect(isPlatformSession(delegated)).toBe(true);
    expect(canAccessGlobalRoute(delegated, "candidate.view")).toBe(true);
    expect(canAccessGlobalRoute(delegated, "admin.view")).toBe(false);
    expect(hasPermission(delegated, "commerce.view")).toBe(false);
  });

  it("denies Organization Admin access to every global platform route", () => {
    const organizationAdmin = session("ORGANIZATION_ADMIN", "tenant-id");
    expect(canAccessGlobalRoute(organizationAdmin, "candidate.view")).toBe(false);
    expect(canAccessGlobalRoute(organizationAdmin, "admin.view")).toBe(false);
    expect(hasPermission(organizationAdmin, "assessment.manage")).toBe(true);
  });

  it("accepts only local same-origin redirect paths", () => {
    expect(safeNextPath("/admin/users")).toBe("/admin/users");
    expect(safeNextPath("//evil.example/path")).toBe("/admin");
    expect(safeNextPath("https://evil.example")).toBe("/admin");
  });
});
