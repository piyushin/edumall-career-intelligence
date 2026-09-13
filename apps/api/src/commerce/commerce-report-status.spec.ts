import {
  AssessmentAttemptStatus,
  CommerceEntitlementType,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import type { CommercePricingService } from "./commerce-pricing.service";
import { CommerceService } from "./commerce.service";
import { OrderFulfilmentService } from "./order-fulfilment.service";

const context: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  role: MembershipRole.STUDENT,
  sessionId: "session",
};

function submittedAttempt(generationStatus = "GENERATED") {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    status: AssessmentAttemptStatus.SUBMITTED,
    submittedAt: new Date(),
    assignment: {
      organizationId: context.organizationId,
      assessmentVersionId: "55555555-5555-4555-8555-555555555555",
      metadata: { registrationSource: "PUBLIC_SIGNUP" },
      assessmentVersion: { title: "Career Profile" },
      user: { email: "candidate@example.com", firstName: "A", lastName: "Candidate" },
    },
    scoringRuns: [
      { id: "run", reportDataSnapshots: [{ id: "snapshot", generatedAt: new Date() }] },
    ],
    reportGeneration: {
      status: generationStatus,
      reportDataSnapshot: { id: "snapshot", generatedAt: new Date() },
    },
    reportReleases: [],
  };
}

function setup(entitlements: unknown[] = [], generationStatus = "GENERATED") {
  const prisma = {
    assessmentAttempt: { findFirst: vi.fn().mockResolvedValue(submittedAttempt(generationStatus)) },
    commerceProduct: { findMany: vi.fn().mockResolvedValue([]) },
    commerceEntitlement: { findMany: vi.fn().mockResolvedValue(entitlements) },
  };
  return {
    prisma,
    service: new CommerceService(prisma as unknown as PrismaClient, new OrderFulfilmentService(), {
      resolvePrice: vi.fn(),
      computeTotals: vi.fn(),
    } as unknown as CommercePricingService),
  };
}

describe("candidate report commerce status", () => {
  it("reports generated commercial reports as ready and locked without a release row", async () => {
    const { service } = setup();
    const result = await service.getCandidateCheckout(context, submittedAttempt().id);

    expect(result.reportStatus).toBe("DETAILED_REPORT_READY_LOCKED");
    expect(result.reportStatus).not.toBe("AWAITING_RELEASE");
    expect(result.reportReleased).toBe(false);
    expect(result.reportAccess).toBe(false);
  });

  it("reports the same already-generated report as unlocked after entitlement", async () => {
    const { service } = setup([
      {
        type: CommerceEntitlementType.REPORT,
        grantedAt: new Date(),
        expiresAt: null,
        source: "COUPON",
      },
    ]);
    const result = await service.getCandidateCheckout(context, submittedAttempt().id);

    expect(result.reportStatus).toBe("DETAILED_REPORT_UNLOCKED");
    expect(result.reportAccess).toBe(true);
  });

  it("surfaces configuration and generation failures rather than legacy release status", async () => {
    const blocked = await setup([], "BLOCKED_CONFIGURATION").service.getCandidateCheckout(
      context,
      submittedAttempt().id,
    );
    const failed = await setup([], "FAILED").service.getCandidateCheckout(
      context,
      submittedAttempt().id,
    );

    expect(blocked.reportStatus).toBe("REPORT_CONFIGURATION_BLOCKED");
    expect(failed.reportStatus).toBe("REPORT_GENERATION_FAILED");
  });
});
