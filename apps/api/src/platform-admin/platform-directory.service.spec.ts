import {
  AssessmentAttemptStatus,
  CommerceEntitlementStatus,
  CommerceOrderStatus,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { PlatformDirectoryService } from "./platform-directory.service";

const superContext: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  organizationId: null,
  role: MembershipRole.SUPER_ADMIN,
  permissions: ["*"],
};

function dashboardPrisma() {
  return {
    user: {
      count: vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(8).mockResolvedValueOnce(6),
    },
    organization: { count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(3) },
    organizationMembership: { count: vi.fn().mockResolvedValue(1) },
    adminProfile: { count: vi.fn().mockResolvedValue(2) },
    assessmentDefinition: { count: vi.fn().mockResolvedValue(5) },
    assessmentAssignment: { count: vi.fn().mockResolvedValue(20) },
    assessmentAttempt: {
      count: vi
        .fn()
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3),
    },
    assessmentReportRelease: { count: vi.fn().mockResolvedValue(4) },
    commerceOrder: { count: vi.fn().mockResolvedValueOnce(9).mockResolvedValueOnce(3) },
    commercePayment: { count: vi.fn().mockResolvedValue(3) },
    commerceEntitlement: { count: vi.fn().mockResolvedValue(2) },
    auditLog: { findMany: vi.fn().mockResolvedValue([{ id: "audit-safe" }]) },
  };
}

describe("PlatformDirectoryService", () => {
  it("returns safe permission-aware dashboard metrics", async () => {
    const prisma = dashboardPrisma();
    const result = await new PlatformDirectoryService(prisma as unknown as PrismaClient).dashboard(
      superContext,
    );
    expect(result).toMatchObject({
      users: { total: 10, active: 8 },
      organizations: { total: 4, active: 3 },
      candidates: { total: 6 },
      assessments: { definitions: 5, reports: { released: 4, awaitingRelease: 3 } },
      commerce: { orders: 9 },
      recentActivity: [{ id: "audit-safe" }],
    });
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|tokenHash|metadata/);
  });

  it("omits metric domains a delegated administrator cannot view", async () => {
    const prisma = dashboardPrisma();
    const delegated = {
      ...superContext,
      role: MembershipRole.PLATFORM_ADMIN,
      permissions: ["admin.view"],
    };
    const result = await new PlatformDirectoryService(prisma as unknown as PrismaClient).dashboard(
      delegated,
    );
    expect(result).not.toHaveProperty("assessments");
    expect(result).not.toHaveProperty("commerce");
    expect(result).not.toHaveProperty("recentActivity");
    expect(prisma.assessmentDefinition.count).not.toHaveBeenCalled();
  });

  it("denies organization-scoped callers from platform-global directories", async () => {
    const service = new PlatformDirectoryService({} as PrismaClient);
    await expect(
      service.users(
        {
          ...superContext,
          organizationId: "44444444-4444-4444-8444-444444444444",
          role: MembershipRole.ORGANIZATION_ADMIN,
        },
        {},
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PLATFORM_SCOPE_REQUIRED" }),
    });
  });

  it("uses a bounded safe user projection with no credential fields", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { user: { findMany } } as unknown as PrismaClient;
    const result = await new PlatformDirectoryService(prisma).users(superContext, {
      limit: "25",
      search: "asha",
    });
    expect(result).toEqual({ items: [], pageInfo: { hasNext: false, nextCursor: null } });
    const query = JSON.stringify(findMany.mock.calls[0]);
    expect(query).not.toMatch(/passwordHash|failedLoginCount|lockedUntil|tokenHash/);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 26, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );
  });

  it("combines user filters without allowing one relation filter to overwrite another", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { user: { findMany } } as unknown as PrismaClient;
    await new PlatformDirectoryService(prisma).users(superContext, {
      candidateSegment: "COLLEGE",
      assessmentState: AssessmentAttemptStatus.SUBMITTED,
      reportState: "RELEASED",
      paymentState: CommerceOrderStatus.PAID,
      entitlementState: CommerceEntitlementStatus.ACTIVE,
    });
    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where.AND).toHaveLength(5);
    expect(JSON.stringify(where)).toContain("productSegment");
    expect(JSON.stringify(where)).toContain("reportReleases");
    expect(JSON.stringify(where)).toContain("commerceEntitlements");
  });

  it("prevents delegated candidate readers from probing commerce state", async () => {
    const delegated = {
      ...superContext,
      role: MembershipRole.PLATFORM_ADMIN,
      permissions: ["candidate.view"],
    };
    await expect(
      new PlatformDirectoryService({} as PrismaClient).users(delegated, {
        paymentState: CommerceOrderStatus.PAID,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "COMMERCE_PERMISSION_REQUIRED" }),
    });
  });

  it("omits commerce and administrator data from delegated user detail projections", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      email: "candidate@example.com",
      assignedAssessments: [],
    });
    const delegated = {
      ...superContext,
      role: MembershipRole.PLATFORM_ADMIN,
      permissions: ["candidate.view"],
    };
    await new PlatformDirectoryService({ user: { findFirst } } as unknown as PrismaClient).user(
      delegated,
      "55555555-5555-4555-8555-555555555555",
    );
    expect(findFirst.mock.calls[0]?.[0]?.select).toMatchObject({
      adminProfile: false,
      commerceOrders: false,
      commerceEntitlements: false,
    });
  });

  it("projects candidate segment without returning unrestricted assignment metadata", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      email: "candidate@example.com",
      assignedAssessments: [
        {
          id: "assignment-id",
          metadata: { productSegment: "COLLEGE", privateImportPayload: "never-return" },
          attempts: [],
        },
      ],
    });
    const result = await new PlatformDirectoryService({
      user: { findFirst },
    } as unknown as PrismaClient).user(superContext, "55555555-5555-4555-8555-555555555555");
    expect(result).toMatchObject({ candidateSegment: "COLLEGE" });
    expect(JSON.stringify(result)).not.toContain("privateImportPayload");
    expect(JSON.stringify(result)).not.toContain("metadata");
  });

  it("returns deterministic organization pages with bounded member summaries", async () => {
    const createdAt = new Date("2026-08-25T10:00:00Z");
    const organization = {
      id: "44444444-4444-4444-8444-444444444444",
      name: "School A",
      slug: "school-a",
      type: "SCHOOL",
      status: "ACTIVE",
      createdAt,
    };
    const findMany = vi.fn().mockResolvedValue([organization]);
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([{ organizationId: organization.id, _count: { _all: 12 } }])
      .mockResolvedValueOnce([{ organizationId: organization.id, _count: { _all: 10 } }])
      .mockResolvedValueOnce([{ organizationId: organization.id, _count: { _all: 2 } }]);
    const prisma = {
      organization: { findMany },
      organizationMembership: { groupBy },
    } as unknown as PrismaClient;

    const result = await new PlatformDirectoryService(prisma).organizations(superContext, {
      search: "School",
      limit: "20",
    });

    expect(result.items[0]).toMatchObject({
      memberCount: 12,
      activeMemberCount: 10,
      administratorCount: 2,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );
  });

  it("does not select organization commerce counts without commerce permission", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      _count: { memberships: 1, assessmentAssignments: 2 },
    });
    const prisma = {
      organization: { findFirst },
      organizationMembership: { count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaClient;
    await new PlatformDirectoryService(prisma).organization(
      { ...superContext, role: MembershipRole.PLATFORM_ADMIN, permissions: ["organization.view"] },
      "44444444-4444-4444-8444-444444444444",
    );
    expect(findFirst.mock.calls[0]?.[0]?.select?._count?.select).toEqual({
      memberships: true,
    });
  });
});
