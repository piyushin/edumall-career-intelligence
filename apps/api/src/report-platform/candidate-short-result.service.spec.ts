import {
  AssessmentAttemptStatus,
  AssessmentReportGenerationStatus,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { CandidateShortResultService } from "./candidate-short-result.service";

const context: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  role: MembershipRole.STUDENT,
  sessionId: "session",
};

const payload = {
  schemaVersion: "assessment-report-data-v3",
  candidate: { email: "private@example.com" },
  scoring: {
    scoringRunId: "secret-run-id",
    constructs: [
      {
        assessmentConstructId: "construct-1",
        code: "INTERNAL_KEY",
        name: "Analytical Thinking",
        description: "Published construct description.",
        rawScore: "99",
      },
    ],
  },
  norms: [
    {
      assessmentConstructId: "construct-1",
      percentile: "88",
      standardizedScore: "61",
      normLookupRowId: "secret-row-id",
    },
  ],
  interpretation: {
    applications: [
      {
        assessmentConstructId: "construct-1",
        metricValue: "88",
        outputData: { label: "Strong", summary: "Published profile summary." },
      },
    ],
  },
  careerFit: {
    rankedCareerPaths: [
      {
        rank: 1,
        score: "91",
        careerPathName: "Data Analysis",
        careerPathDescription: "Published path description.",
        careerClusterName: "Technology",
        evidence: { private: true },
        recommendationBand: {
          label: "Strong fit",
          outputData: { summary: "Published recommendation." },
        },
      },
    ],
  },
  provenance: { completePremiumMethodology: "not for short result" },
};

function prisma(attempt: unknown) {
  return {
    assessmentAttempt: { findFirst: vi.fn().mockResolvedValue(attempt) },
  };
}

function generatedAttempt() {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    status: AssessmentAttemptStatus.SUBMITTED,
    submittedAt: new Date("2026-09-11T10:00:00Z"),
    assignment: { assessmentVersion: { title: "Career Profile" } },
    scoringRuns: [{ id: "run" }],
    reportGeneration: {
      status: AssessmentReportGenerationStatus.GENERATED,
      lastErrorCode: null,
      reportDataSnapshot: { payload },
    },
  };
}

describe("CandidateShortResultService", () => {
  it("returns a useful governed summary without checking payment", async () => {
    const client = prisma(generatedAttempt());
    const result = await new CandidateShortResultService(
      client as unknown as PrismaClient,
    ).getOwnShortResult(context, "44444444-4444-4444-8444-444444444444");

    expect(result).toMatchObject({
      status: "AVAILABLE",
      profileOverview: "Published profile summary.",
      strongestIndicators: [{ name: "Analytical Thinking", interpretationLabel: "Strong" }],
      careerDirections: [{ name: "Data Analysis", recommendationLabel: "Strong fit" }],
    });
    expect((client as Record<string, unknown>).commerceEntitlement).toBeUndefined();
  });

  it("queries by authenticated candidate and tenant, preventing cross-candidate IDOR", async () => {
    const client = prisma(null);
    await expect(
      new CandidateShortResultService(client as unknown as PrismaClient).getOwnShortResult(
        context,
        "44444444-4444-4444-8444-444444444444",
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ASSESSMENT_RESULT_NOT_FOUND" }),
    });
    expect(client.assessmentAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignment: { userId: context.userId, organizationId: context.organizationId },
        }),
      }),
    );
  });

  it("never projects the complete snapshot, raw scores, internal keys, or provenance", async () => {
    const result = await new CandidateShortResultService(
      prisma(generatedAttempt()) as unknown as PrismaClient,
    ).getOwnShortResult(context, "44444444-4444-4444-8444-444444444444");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("rawScore");
    expect(serialized).not.toContain("INTERNAL_KEY");
    expect(serialized).not.toContain("secret-run-id");
    expect(serialized).not.toContain("completePremiumMethodology");
    expect(serialized).not.toContain("private@example.com");
  });

  it("returns a safe configuration status instead of a false result", async () => {
    const blocked = generatedAttempt();
    blocked.reportGeneration = {
      status: AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION as never,
      lastErrorCode: "REPORT_CONFIGURATION_UNAVAILABLE" as never,
      reportDataSnapshot: { payload: null as never },
    };
    const result = await new CandidateShortResultService(
      prisma(blocked) as unknown as PrismaClient,
    ).getOwnShortResult(context, blocked.id);

    expect(result).toMatchObject({
      status: "CONFIGURATION_BLOCKED",
      errorCode: "REPORT_CONFIGURATION_UNAVAILABLE",
    });
  });
});
