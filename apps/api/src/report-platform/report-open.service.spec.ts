import { MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import type { ReportAccessPolicyService } from "./report-access-policy.service";
import { ReportOpenService } from "./report-open.service";

const context: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.PLATFORM_ADMIN,
  sessionId: "session",
  permissions: ["report.view.full", "report.download"],
};

describe("ReportOpenService", () => {
  it("opens the immutable generation-linked snapshot without a legacy release", async () => {
    const snapshot = {
      id: "snapshot",
      inputHash: "a".repeat(64),
      reportVersion: "R20",
      generatedAt: new Date(),
      payload: { schemaVersion: "assessment-report-data-v3" },
    };
    const prisma = {
      assessmentAttempt: {
        findUnique: vi.fn().mockResolvedValue({
          reportGeneration: { status: "GENERATED", reportDataSnapshot: snapshot },
          scoringRuns: [],
        }),
      },
    };
    const policy = {
      assertCanOpenFullReport: vi.fn().mockResolvedValue({ allowed: true }),
      assertCanDownloadFullReport: vi.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new ReportOpenService(
      prisma as unknown as PrismaClient,
      policy as unknown as ReportAccessPolicyService,
    );

    await expect(service.open(context, "attempt")).resolves.toMatchObject({ report: snapshot });
    await expect(service.openForDownload(context, "attempt")).resolves.toMatchObject({
      report: snapshot,
    });
    expect(policy.assertCanOpenFullReport).toHaveBeenCalled();
    expect(policy.assertCanDownloadFullReport).toHaveBeenCalled();
    expect((prisma as Record<string, unknown>).assessmentReportRelease).toBeUndefined();
  });
});
