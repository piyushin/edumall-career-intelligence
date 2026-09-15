import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AssessmentReportReleaseStatus, MembershipRole, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentReportViewService } from "./assessment-report-view.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const constructId = "44444444-4444-4444-8444-444444444444";

const context: AuthContext = {
  userId,
  organizationId,
  membershipId: "55555555-5555-4555-8555-555555555555",
  role: MembershipRole.STUDENT,
  sessionId: "66666666-6666-4666-8666-666666666666",
};

function createPrisma() {
  return {
    assessmentAttempt: {
      findFirst: vi.fn(),
    },
    assessmentReportRelease: {
      findUnique: vi.fn(),
    },
  };
}

describe("AssessmentReportViewService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentReportViewService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentReportViewService(prisma as unknown as PrismaClient);
  });

  it("requires an organization-scoped session", async () => {
    await expect(
      service.getMyReport({ ...context, organizationId: null }, attemptId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not find another candidate's attempt", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(null);

    await expect(service.getMyReport(context, attemptId)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assessmentAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: attemptId,
          assignment: { organizationId, userId },
        },
      }),
    );
  });

  it("reports pending when no release exists yet", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({ id: attemptId });
    prisma.assessmentReportRelease.findUnique.mockResolvedValue(null);

    const result = await service.getMyReport(context, attemptId);

    expect(result).toEqual({ status: "PENDING" });
  });

  it("reports pending while awaiting counsellor review", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({ id: attemptId });
    prisma.assessmentReportRelease.findUnique.mockResolvedValue({
      status: AssessmentReportReleaseStatus.PENDING_REVIEW,
      releasedAt: null,
      reportDataSnapshot: { payload: {} },
    });

    const result = await service.getMyReport(context, attemptId);

    expect(result).toEqual({ status: "PENDING" });
  });

  it("reports withdrawn without exposing prior report content", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({ id: attemptId });
    prisma.assessmentReportRelease.findUnique.mockResolvedValue({
      status: AssessmentReportReleaseStatus.WITHDRAWN,
      releasedAt: new Date("2026-01-01T00:00:00Z"),
      reportDataSnapshot: { payload: { assessment: { title: "should not leak" } } },
    });

    const result = await service.getMyReport(context, attemptId);

    expect(result).toEqual({ status: "WITHDRAWN" });
  });

  it("returns only the student-friendly summary when released", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({ id: attemptId });

    const releasedAt = new Date("2026-01-02T00:00:00Z");

    prisma.assessmentReportRelease.findUnique.mockResolvedValue({
      status: AssessmentReportReleaseStatus.RELEASED,
      releasedAt,
      reportDataSnapshot: {
        payload: {
          assessment: {
            title: "Career Aptitude Assessment",
            edition: "2026",
            form: "A",
            language: "en",
          },
          scoring: {
            constructs: [{ assessmentConstructId: constructId, code: "logic", name: "Logic" }],
          },
          interpretation: {
            applications: [
              {
                assessmentConstructId: constructId,
                ruleCode: "logic-high",
                outputData: { band: "Strong" },
              },
            ],
          },
        },
      },
    });

    const result = await service.getMyReport(context, attemptId);

    expect(result).toEqual({
      status: "RELEASED",
      releasedAt,
      assessment: {
        title: "Career Aptitude Assessment",
        edition: "2026",
        form: "A",
        language: "en",
      },
      results: [
        {
          constructCode: "logic",
          constructName: "Logic",
          outputData: { band: "Strong" },
        },
      ],
    });
  });

  describe("getReleasedReportForPdf", () => {
    it("rejects a report that has not been released", async () => {
      prisma.assessmentAttempt.findFirst.mockResolvedValue({
        assignment: {
          user: { firstName: "Asha", lastName: "Patel" },
          organization: { name: "Gandhinagar Model School" },
        },
      });
      prisma.assessmentReportRelease.findUnique.mockResolvedValue({
        status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        releasedAt: null,
        reportDataSnapshot: { payload: {} },
      });

      await expect(service.getReleasedReportForPdf(context, attemptId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("does not find another candidate's attempt", async () => {
      prisma.assessmentAttempt.findFirst.mockResolvedValue(null);

      await expect(service.getReleasedReportForPdf(context, attemptId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("resolves candidate and organization names alongside the summary", async () => {
      prisma.assessmentAttempt.findFirst.mockResolvedValue({
        assignment: {
          user: { firstName: "Asha", lastName: "Patel" },
          organization: { name: "Gandhinagar Model School" },
        },
      });

      const releasedAt = new Date("2026-01-02T00:00:00Z");

      prisma.assessmentReportRelease.findUnique.mockResolvedValue({
        status: AssessmentReportReleaseStatus.RELEASED,
        releasedAt,
        reportDataSnapshot: {
          payload: {
            assessment: {
              title: "Career Aptitude Assessment",
              edition: "2026",
              form: "A",
              language: "en",
            },
            scoring: {
              constructs: [{ assessmentConstructId: constructId, code: "logic", name: "Logic" }],
            },
            interpretation: {
              applications: [
                {
                  assessmentConstructId: constructId,
                  ruleCode: "logic-high",
                  outputData: { band: "Strong" },
                },
              ],
            },
          },
        },
      });

      const result = await service.getReleasedReportForPdf(context, attemptId);

      expect(result).toEqual({
        releasedAt,
        candidateName: "Asha Patel",
        organizationName: "Gandhinagar Model School",
        assessment: {
          title: "Career Aptitude Assessment",
          edition: "2026",
          form: "A",
          language: "en",
        },
        results: [
          {
            constructCode: "logic",
            constructName: "Logic",
            outputData: { band: "Strong" },
          },
        ],
      });
    });
  });
});
