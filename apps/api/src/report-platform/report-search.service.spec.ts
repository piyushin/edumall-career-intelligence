import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ReportSearchService } from "./report-search.service";
import type { ReportSearchQueryDto } from "./report-platform.types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const base = {
  userId,
  organizationId: null,
  membershipId: null,
  sessionId: "session",
  permissions: ["report.search"],
};

function client(items: unknown[] = []) {
  return {
    assessmentAttempt: {
      count: vi.fn().mockResolvedValue(items.length),
      findMany: vi.fn().mockResolvedValue(items),
    },
  };
}

const emptyQuery = { page: 1, pageSize: 25 } as ReportSearchQueryDto;

describe("ReportSearchService scope and filters", () => {
  it("lets platform administrators search across platform data", async () => {
    const prisma = client();
    await new ReportSearchService(prisma as unknown as PrismaClient).searchAdmin(
      { ...base, role: MembershipRole.SUPER_ADMIN, permissions: ["*"] },
      emptyQuery,
    );
    const assignment = prisma.assessmentAttempt.findMany.mock.calls[0]![0].where.assignment;
    expect(assignment).not.toHaveProperty("organizationId");
  });

  it("enforces organization-admin tenant isolation", async () => {
    const service = new ReportSearchService(client() as unknown as PrismaClient);
    await expect(
      service.searchAdmin(
        { ...base, organizationId, role: MembershipRole.ORGANIZATION_ADMIN },
        { ...emptyQuery, organizationId: "99999999-9999-4999-8999-999999999999" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("limits counsellors to active server-side candidate assignments", async () => {
    const prisma = client();
    await new ReportSearchService(prisma as unknown as PrismaClient).searchStaff(
      { ...base, organizationId, role: MembershipRole.COUNSELLOR },
      emptyQuery,
    );
    const where = prisma.assessmentAttempt.findMany.mock.calls[0]![0].where;
    expect(where.assignment.user.counsellorCandidateAssignments.some).toMatchObject({
      organizationId,
      counsellorUserId: userId,
      status: "ACTIVE",
    });
  });

  it("does not allow candidates to call report search services", () => {
    const service = new ReportSearchService(client() as unknown as PrismaClient);
    expect(() =>
      service.searchStaff({ ...base, organizationId, role: MembershipRole.STUDENT }, emptyQuery),
    ).toThrow(ForbiddenException);
  });

  it("builds name, email, mobile, date-range, tenant, assessment and status filters", async () => {
    const prisma = client();
    await new ReportSearchService(prisma as unknown as PrismaClient).searchAdmin(
      { ...base, role: MembershipRole.SUPER_ADMIN, permissions: ["*"] },
      {
        ...emptyQuery,
        candidateName: "Asha Patel",
        email: "asha@",
        mobile: "+91 98765",
        submittedFrom: "2026-09-01T00:00:00.000Z",
        submittedTo: "2026-09-10T23:59:59.000Z",
        tenantName: "North School",
        assessmentId: "33333333-3333-4333-8333-333333333333",
        assessmentVersionId: "44444444-4444-4444-8444-444444444444",
        generationStatus: "GENERATED",
        entitlementStatus: "ACTIVE",
      },
    );
    const serialized = JSON.stringify(prisma.assessmentAttempt.findMany.mock.calls[0]![0].where);
    expect(serialized).toContain("Asha");
    expect(serialized).toContain("Patel");
    expect(serialized).toContain("asha@");
    expect(serialized).toContain("+9198765");
    expect(serialized).toContain("2026-09-01");
    expect(serialized).toContain("2026-09-10");
    expect(serialized).toContain("North School");
    expect(serialized).toContain("GENERATED");
  });

  it("keeps search permission separate from full-report permission", async () => {
    const prisma = client([
      {
        id: "attempt",
        attemptNumber: 1,
        submittedAt: new Date(),
        assignment: {
          user: { id: "candidate", counsellorCandidateAssignments: [] },
          organization: { id: organizationId },
          assessmentVersion: { id: "version" },
        },
        reportGeneration: null,
        commerceEntitlements: [],
        reportAccessGrants: [],
      },
    ]);
    const result = await new ReportSearchService(prisma as unknown as PrismaClient).searchAdmin(
      { ...base, role: MembershipRole.PLATFORM_ADMIN },
      emptyQuery,
    );
    expect(result.items[0]?.canViewFullReport).toBe(false);
  });

  it("returns a scoped detail projection without opening the full report", async () => {
    const prisma = client([
      {
        id: "11111111-1111-4111-8111-111111111111",
        attemptNumber: 1,
        submittedAt: new Date(),
        assignment: {
          user: { id: "candidate", counsellorCandidateAssignments: [] },
          organization: { id: organizationId },
          assessmentVersion: { id: "version" },
        },
        reportGeneration: { status: "GENERATED" },
        commerceEntitlements: [],
        reportAccessGrants: [],
      },
    ]);
    const result = await new ReportSearchService(prisma as unknown as PrismaClient).adminDetail(
      { ...base, role: MembershipRole.PLATFORM_ADMIN },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result).toMatchObject({
      attemptId: "11111111-1111-4111-8111-111111111111",
      generationStatus: "GENERATED",
      canViewFullReport: false,
    });
    expect(JSON.stringify(result)).not.toContain("payload");
    expect(prisma.assessmentAttempt.findMany.mock.calls[0]![0].where).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "SUBMITTED",
    });
  });

  it("does not return a different record when the detail identifier is not matched exactly", async () => {
    const prisma = client([
      {
        id: "55555555-5555-4555-8555-555555555555",
        attemptNumber: 1,
        submittedAt: new Date(),
        assignment: {
          user: { id: "candidate", counsellorCandidateAssignments: [] },
          organization: { id: organizationId },
          assessmentVersion: { id: "version" },
        },
        reportGeneration: null,
        commerceEntitlements: [],
        reportAccessGrants: [],
      },
    ]);
    await expect(
      new ReportSearchService(prisma as unknown as PrismaClient).staffDetail(
        { ...base, organizationId, role: MembershipRole.COUNSELLOR },
        "11111111-1111-4111-8111-111111111111",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
