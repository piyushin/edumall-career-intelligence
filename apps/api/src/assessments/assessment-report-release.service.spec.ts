import { ConflictException, NotFoundException } from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentReportReleaseService } from "./assessment-report-release.service";
import type { AssessmentReportWorkflowService } from "./assessment-report-workflow.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const snapshotId = "33333333-3333-4333-8333-333333333333";
const releaseId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

const counsellorContext: AuthContext = {
  userId,
  organizationId,
  membershipId: "66666666-6666-4666-8666-666666666666",
  role: MembershipRole.COUNSELLOR,
  sessionId: "77777777-7777-4777-8777-777777777777",
};

const candidateContext: AuthContext = {
  userId: "88888888-8888-4888-8888-888888888888",
  organizationId,
  membershipId: "99999999-9999-4999-8999-999999999999",
  role: MembershipRole.STUDENT,
  sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function validSnapshot() {
  return {
    id: snapshotId,
    reportVersion: "report-v3",
    inputHash: "a".repeat(64),
    generatedAt: new Date(),
    payload: {
      schemaVersion: "assessment-report-data-v3",
      careerFit: {
        rankedCareerPaths: [{ careerPathId: "path-1", rank: 1 }],
      },
    },
  };
}

describe("AssessmentReportReleaseService", () => {
  let prisma: {
    assessmentReportRelease: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let workflow: {
    getReadiness: ReturnType<typeof vi.fn>;
  };
  let releaseCreate: ReturnType<typeof vi.fn>;
  let auditCreate: ReturnType<typeof vi.fn>;
  let service: AssessmentReportReleaseService;

  beforeEach(() => {
    releaseCreate = vi.fn();
    auditCreate = vi.fn();

    prisma = {
      assessmentReportRelease: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          assessmentReportRelease: { create: releaseCreate },
          auditLog: { create: auditCreate },
        }),
      ),
    };

    workflow = {
      getReadiness: vi.fn(),
    };

    service = new AssessmentReportReleaseService(
      prisma as unknown as PrismaClient,
      workflow as unknown as AssessmentReportWorkflowService,
    );
  });

  it("refuses release before a governed snapshot exists", async () => {
    workflow.getReadiness.mockResolvedValue({ latestSnapshot: null });

    await expect(service.release(counsellorContext, attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("refuses candidate release when deterministic CareerFit evidence is absent", async () => {
    workflow.getReadiness.mockResolvedValue({
      latestSnapshot: {
        ...validSnapshot(),
        payload: { schemaVersion: "assessment-report-data-v3" },
      },
    });

    await expect(service.release(counsellorContext, attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("creates immutable release evidence and an audit event", async () => {
    workflow.getReadiness.mockResolvedValue({ latestSnapshot: validSnapshot() });
    prisma.assessmentReportRelease.findUnique.mockResolvedValue(null);
    releaseCreate.mockResolvedValue({
      id: releaseId,
      organizationId,
      attemptId,
      reportDataSnapshotId: snapshotId,
      releasedByUserId: userId,
      reviewedAt: new Date(),
      releasedAt: new Date(),
    });
    auditCreate.mockResolvedValue({ id: "audit-1" });

    const result = await service.release(counsellorContext, attemptId);

    expect(result.id).toBe(releaseId);
    expect(releaseCreate).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(auditCreate.mock.calls[0]?.[0]?.data.action).toBe("assessment_report.released");
  });

  it("returns only a released snapshot owned by the signed-in candidate", async () => {
    prisma.assessmentReportRelease.findFirst.mockResolvedValue({
      id: releaseId,
      reviewedAt: new Date(),
      releasedAt: new Date(),
      reportDataSnapshot: validSnapshot(),
    });

    const result = await service.getCandidateReleasedSnapshot(candidateContext, attemptId);

    expect(result.id).toBe(releaseId);
    expect(prisma.assessmentReportRelease.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          attemptId,
          attempt: {
            assignment: {
              organizationId,
              userId: candidateContext.userId,
            },
          },
        }),
      }),
    );
  });

  it("does not leak unreleased or another candidate report", async () => {
    prisma.assessmentReportRelease.findFirst.mockResolvedValue(null);

    await expect(
      service.getCandidateReleasedSnapshot(candidateContext, attemptId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
