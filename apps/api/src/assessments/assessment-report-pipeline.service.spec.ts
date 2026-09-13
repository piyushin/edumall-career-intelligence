import { ConflictException } from "@nestjs/common";
import { AssessmentNormSetStatus, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentInterpretationService } from "./assessment-interpretation.service";
import type { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentReportPipelineService } from "./assessment-report-pipeline.service";
import type { AssessmentReportDataService } from "./assessment-report-data.service";
import type { AssessmentScoringService } from "./assessment-scoring.service";

const attemptId = "11111111-1111-4111-8111-111111111111";
const scoringRunId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const assessmentVersionId = "44444444-4444-4444-8444-444444444444";
const normGroupId = "55555555-5555-4555-8555-555555555555";
const interpretationSetId = "66666666-6666-4666-8666-666666666666";
const snapshotId = "77777777-7777-4777-8777-777777777777";
const releaseId = "88888888-8888-4888-8888-888888888888";

function createPrisma() {
  return {
    assessmentScoringRun: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        attempt: {
          assignment: {
            organizationId,
            assessmentVersionId,
            assessmentVersion: {
              normVersion: "norm-v1",
            },
          },
        },
      }),
    },
    assessmentNormSet: {
      findUnique: vi.fn().mockResolvedValue({
        status: AssessmentNormSetStatus.PUBLISHED,
        groups: [{ id: normGroupId }],
      }),
    },
    assessmentInterpretationSet: {
      findMany: vi.fn().mockResolvedValue([{ id: interpretationSetId }]),
    },
    assessmentReportRelease: {
      upsert: vi.fn().mockResolvedValue({ id: releaseId }),
    },
  };
}

function createServices() {
  return {
    scoring: {
      scoreSubmittedAttempt: vi.fn().mockResolvedValue({ id: scoringRunId }),
    },
    norm: {
      applyPublishedNormGroup: vi.fn().mockResolvedValue([]),
    },
    interpretation: {
      applyPublishedInterpretationSet: vi.fn().mockResolvedValue([]),
    },
    reportData: {
      createSnapshot: vi.fn().mockResolvedValue({ id: snapshotId }),
    },
  };
}

describe("AssessmentReportPipelineService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let services: ReturnType<typeof createServices>;
  let service: AssessmentReportPipelineService;

  beforeEach(() => {
    prisma = createPrisma();
    services = createServices();
    service = new AssessmentReportPipelineService(
      prisma as unknown as PrismaClient,
      services.scoring as unknown as AssessmentScoringService,
      services.norm as unknown as AssessmentNormService,
      services.interpretation as unknown as AssessmentInterpretationService,
      services.reportData as unknown as AssessmentReportDataService,
    );
  });

  it("scores, norms, interprets, snapshots, and opens a pending review when everything is published", async () => {
    const result = await service.generateReportIfReady(attemptId);

    expect(result).toEqual({
      generated: true,
      scoringRunId,
      snapshotId,
      releaseId,
    });

    expect(services.norm.applyPublishedNormGroup).toHaveBeenCalledWith(scoringRunId, normGroupId);
    expect(services.interpretation.applyPublishedInterpretationSet).toHaveBeenCalledWith(
      scoringRunId,
      normGroupId,
      interpretationSetId,
    );
    expect(services.reportData.createSnapshot).toHaveBeenCalledWith(
      scoringRunId,
      normGroupId,
      interpretationSetId,
    );
    expect(prisma.assessmentReportRelease.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { attemptId },
        create: {
          attemptId,
          organizationId,
          reportDataSnapshotId: snapshotId,
        },
        update: {},
      }),
    );
  });

  it("is not ready when no norm set exists for the pinned norm version", async () => {
    prisma.assessmentNormSet.findUnique.mockResolvedValue(null);

    const result = await service.generateReportIfReady(attemptId);

    expect(result).toEqual({ generated: false, reason: "NORM_SET_NOT_PUBLISHED" });
    expect(services.norm.applyPublishedNormGroup).not.toHaveBeenCalled();
  });

  it("is not ready when the norm set is still draft", async () => {
    prisma.assessmentNormSet.findUnique.mockResolvedValue({
      status: AssessmentNormSetStatus.DRAFT,
      groups: [{ id: normGroupId }],
    });

    const result = await service.generateReportIfReady(attemptId);

    expect(result).toEqual({ generated: false, reason: "NORM_SET_NOT_PUBLISHED" });
  });

  it("is not ready when the published norm set has no groups", async () => {
    prisma.assessmentNormSet.findUnique.mockResolvedValue({
      status: AssessmentNormSetStatus.PUBLISHED,
      groups: [],
    });

    const result = await service.generateReportIfReady(attemptId);

    expect(result).toEqual({ generated: false, reason: "NORM_GROUP_MISSING" });
  });

  it("throws when the published norm set has more than one group", async () => {
    prisma.assessmentNormSet.findUnique.mockResolvedValue({
      status: AssessmentNormSetStatus.PUBLISHED,
      groups: [{ id: normGroupId }, { id: "99999999-9999-4999-8999-999999999999" }],
    });

    await expect(service.generateReportIfReady(attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(services.norm.applyPublishedNormGroup).not.toHaveBeenCalled();
  });

  it("is not ready when no interpretation set is published", async () => {
    prisma.assessmentInterpretationSet.findMany.mockResolvedValue([]);

    const result = await service.generateReportIfReady(attemptId);

    expect(result).toEqual({ generated: false, reason: "INTERPRETATION_SET_NOT_PUBLISHED" });
    expect(services.interpretation.applyPublishedInterpretationSet).not.toHaveBeenCalled();
  });

  it("throws when more than one interpretation set is published", async () => {
    prisma.assessmentInterpretationSet.findMany.mockResolvedValue([
      { id: interpretationSetId },
      { id: "99999999-9999-4999-8999-999999999999" },
    ]);

    await expect(service.generateReportIfReady(attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(services.reportData.createSnapshot).not.toHaveBeenCalled();
  });
});
