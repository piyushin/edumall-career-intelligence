import {
  AssessmentAttemptStatus,
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  AssessmentReportGenerationStatus,
  CareerFitModelStatus,
  CareerTaxonomyVersionStatus,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentInterpretationService } from "../assessments/assessment-interpretation.service";
import type { AssessmentReportDataService } from "../assessments/assessment-report-data.service";
import type { CareerFitExecutionService } from "../career-intelligence/career-fit-execution.service";
import { AutomaticReportProcessingService } from "./automatic-report-processing.service";

const attemptId = "11111111-1111-4111-8111-111111111111";
const generationId = "22222222-2222-4222-8222-222222222222";
const scoringRunId = "33333333-3333-4333-8333-333333333333";
const configurationId = "44444444-4444-4444-8444-444444444444";
const snapshotId = "55555555-5555-4555-8555-555555555555";

function attempt(
  reportGeneration: {
    id: string;
    status: AssessmentReportGenerationStatus;
    attemptCount: number;
    reportDataSnapshotId: string | null;
    reportDataSnapshot: { id: string } | null;
  } | null = null,
) {
  return {
    id: attemptId,
    status: AssessmentAttemptStatus.SUBMITTED,
    assignment: {
      organizationId: "66666666-6666-4666-8666-666666666666",
      userId: "77777777-7777-4777-8777-777777777777",
      assessmentVersionId: "88888888-8888-4888-8888-888888888888",
      assessmentVersion: { normVersion: "N1" },
    },
    reportGeneration,
    scoringRuns: [{ id: scoringRunId }],
  };
}

const configuration = {
  id: configurationId,
  assessmentVersionId: "88888888-8888-4888-8888-888888888888",
  normGroupId: "99999999-9999-4999-8999-999999999999",
  interpretationSetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  careerFitModelId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  reportTemplateVersion: "1",
  normGroup: {
    normSet: {
      assessmentVersionId: "88888888-8888-4888-8888-888888888888",
      normVersion: "N1",
      status: AssessmentNormSetStatus.PUBLISHED,
    },
  },
  interpretationSet: {
    assessmentVersionId: "88888888-8888-4888-8888-888888888888",
    status: AssessmentInterpretationSetStatus.PUBLISHED,
  },
  careerFitModel: {
    assessmentVersionId: "88888888-8888-4888-8888-888888888888",
    status: CareerFitModelStatus.PUBLISHED,
    careerTaxonomyVersion: { status: CareerTaxonomyVersionStatus.PUBLISHED },
  },
};

function setup() {
  const prisma = {
    assessmentAttempt: { findUnique: vi.fn().mockResolvedValue(attempt()) },
    assessmentReportConfiguration: { findMany: vi.fn().mockResolvedValue([configuration]) },
    assessmentReportGeneration: {
      upsert: vi.fn().mockResolvedValue({ id: generationId, attemptCount: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  );
  const careerFit = { executeAutomatic: vi.fn().mockResolvedValue({ id: "run" }) };
  const interpretations = { applyPublishedInterpretationSet: vi.fn().mockResolvedValue([]) };
  const reportData = { createSnapshot: vi.fn().mockResolvedValue({ id: snapshotId }) };
  const service = new AutomaticReportProcessingService(
    prisma as unknown as PrismaClient,
    careerFit as unknown as CareerFitExecutionService,
    interpretations as unknown as AssessmentInterpretationService,
    reportData as unknown as AssessmentReportDataService,
  );
  return { prisma, careerFit, interpretations, reportData, service };
}

describe("AutomaticReportProcessingService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the active configured scientific IDs and generates without a release row", async () => {
    const { prisma, careerFit, interpretations, reportData, service } = setup();

    await expect(service.processSubmittedAttempt(attemptId)).resolves.toMatchObject({
      status: AssessmentReportGenerationStatus.GENERATED,
      reportDataSnapshotId: snapshotId,
    });
    expect(careerFit.executeAutomatic).toHaveBeenCalledWith(
      attemptId,
      configuration.normGroupId,
      configuration.careerFitModelId,
    );
    expect(interpretations.applyPublishedInterpretationSet).toHaveBeenCalledWith(
      scoringRunId,
      configuration.normGroupId,
      configuration.interpretationSetId,
    );
    expect(reportData.createSnapshot).toHaveBeenCalledWith(
      scoringRunId,
      configuration.normGroupId,
      configuration.interpretationSetId,
      expect.objectContaining({ id: configurationId }),
    );
    expect((prisma as Record<string, unknown>).assessmentReportRelease).toBeUndefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorUserId: null, action: "report.processing.generated" }),
      }),
    );
  });

  it("returns an existing immutable generated snapshot without repeating any stage", async () => {
    const { prisma, careerFit, interpretations, reportData, service } = setup();
    prisma.assessmentAttempt.findUnique.mockResolvedValue(
      attempt({
        id: generationId,
        status: AssessmentReportGenerationStatus.GENERATED,
        attemptCount: 1,
        reportDataSnapshotId: snapshotId,
        reportDataSnapshot: { id: snapshotId },
      }),
    );

    await expect(service.processSubmittedAttempt(attemptId)).resolves.toMatchObject({
      reused: true,
      reportDataSnapshotId: snapshotId,
    });
    expect(prisma.assessmentReportGeneration.upsert).not.toHaveBeenCalled();
    expect(careerFit.executeAutomatic).not.toHaveBeenCalled();
    expect(interpretations.applyPublishedInterpretationSet).not.toHaveBeenCalled();
    expect(reportData.createSnapshot).not.toHaveBeenCalled();
  });

  it("records BLOCKED_CONFIGURATION without mutating the submitted attempt", async () => {
    const { prisma, service } = setup();
    prisma.assessmentReportConfiguration.findMany.mockResolvedValue([]);

    await expect(service.processSubmittedAttempt(attemptId)).resolves.toMatchObject({
      status: AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION,
    });
    expect(prisma.assessmentReportGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION,
          lastErrorCode: "REPORT_CONFIGURATION_UNAVAILABLE",
        }),
      }),
    );
    expect((prisma.assessmentAttempt as Record<string, unknown>).update).toBeUndefined();
  });

  it("records a sanitized FAILED state and remains retryable", async () => {
    const { prisma, careerFit, service } = setup();
    careerFit.executeAutomatic.mockRejectedValue(new Error("secret stack detail"));

    await expect(service.processSubmittedAttempt(attemptId)).resolves.toMatchObject({
      status: AssessmentReportGenerationStatus.FAILED,
    });
    expect(prisma.assessmentReportGeneration.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AssessmentReportGenerationStatus.FAILED,
          lastErrorCode: "REPORT_PROCESSING_FAILED",
          lastErrorMessage: expect.not.stringContaining("secret"),
        }),
      }),
    );
  });

  it("can retry a previously blocked generation and generate the same attempt", async () => {
    const { prisma, service } = setup();
    prisma.assessmentAttempt.findUnique.mockResolvedValue(
      attempt({
        id: generationId,
        status: AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION,
        attemptCount: 1,
        reportDataSnapshotId: null,
        reportDataSnapshot: null,
      }),
    );
    prisma.assessmentReportGeneration.upsert.mockResolvedValue({
      id: generationId,
      attemptCount: 2,
    });

    await expect(service.processSubmittedAttempt(attemptId)).resolves.toMatchObject({
      status: AssessmentReportGenerationStatus.GENERATED,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "report.processing.retried", actorUserId: null }),
      }),
    );
  });
});
