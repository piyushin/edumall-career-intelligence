import { ForbiddenException } from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { ReportAccessPolicyService } from "./report-access-policy.service";

const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";

function context(
  role: MembershipRole,
  organizationId: string | null,
  userId = "44444444-4444-4444-8444-444444444444",
): AuthContext {
  return {
    role,
    organizationId,
    userId,
    membershipId: null,
    sessionId: "session",
    permissions: [],
  };
}

function prisma(options: { assignment?: unknown; grant?: unknown } = {}) {
  return {
    assessmentAttempt: {
      findUnique: vi.fn().mockResolvedValue({
        id: "attempt",
        assignment: { organizationId: tenantB, userId: candidateId, metadata: {} },
      }),
    },
    candidateCounsellorAssignment: {
      findFirst: vi.fn().mockResolvedValue(options.assignment ?? null),
    },
    commerceReportAccessGrant: { findFirst: vi.fn().mockResolvedValue(options.grant ?? null) },
    commerceEntitlement: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

describe("ReportAccessPolicyService", () => {
  it("prevents Tenant A from opening Tenant B reports even when an attempt id is known", async () => {
    const service = new ReportAccessPolicyService(
      prisma({ grant: { id: "grant" } }) as unknown as PrismaClient,
    );
    await expect(
      service.assertCanOpenFullReport(
        context(MembershipRole.ORGANIZATION_ADMIN, tenantA),
        "attempt",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("prevents a counsellor opening an unrelated candidate report", async () => {
    const service = new ReportAccessPolicyService(
      prisma({ grant: { id: "grant" } }) as unknown as PrismaClient,
    );
    await expect(
      service.assertCanOpenFullReport(context(MembershipRole.COUNSELLOR, tenantB), "attempt"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires both active assignment and counsellor grant", async () => {
    const service = new ReportAccessPolicyService(
      prisma({
        assignment: { id: "assignment" },
        grant: { id: "grant" },
      }) as unknown as PrismaClient,
    );
    await expect(
      service.assertCanOpenFullReport(context(MembershipRole.COUNSELLOR, tenantB), "attempt"),
    ).resolves.toMatchObject({ basis: "COUNSELLOR_GRANT" });
  });

  it("allows an authorized platform administrator without commerce entitlement", async () => {
    const client = prisma();
    const admin = {
      ...context(MembershipRole.PLATFORM_ADMIN, null),
      permissions: ["report.view.full"],
    };
    await expect(
      new ReportAccessPolicyService(client as unknown as PrismaClient).assertCanOpenFullReport(
        admin,
        "attempt",
      ),
    ).resolves.toMatchObject({ basis: "ADMINISTRATIVE_SCOPE" });
    expect(client.commerceReportAccessGrant.findFirst).not.toHaveBeenCalled();
  });
});
