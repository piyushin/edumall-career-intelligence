import { ConflictException } from "@nestjs/common";
import { AssessmentInterpretationSetStatus, Prisma, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentReportDataService } from "./assessment-report-data.service";

const scoringRunId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const assessmentVersionId = "33333333-3333-4333-8333-333333333333";
const constructId = "44444444-4444-4444-8444-444444444444";
const normGroupId = "55555555-5555-4555-8555-555555555555";
const normApplicationId = "66666666-6666-4666-8666-666666666666";
const interpretationSetId = "77777777-7777-4777-8777-777777777777";
const interpretationRuleId = "88888888-8888-4888-8888-888888888888";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createScoringRun() {
  return {
    id: scoringRunId,
    scoringVersion: "score-v1",
    algorithmVersion: "explicit-option-key-v1",
    inputHash: "a".repeat(64),
    calculatedAt: new Date("2026-08-08T08:00:00.000Z"),
    attempt: {
      id: attemptId,
      assignment: {
        assessmentVersion: {
          id: assessmentVersionId,
          versionNumber: 1,
          title: "Assessment",
          edition: "2026",
          form: "A",
          language: "en",
          scoringVersion: "score-v1",
          normVersion: "norm-v1",
          reportVersion: "report-v1",
        },
      },
    },
    constructScores: [
      {
        assessmentConstructId: constructId,
        rawScore: decimal("12"),
        answeredItemCount: 3,
        contributionCount: 3,
        assessmentConstruct: {
          code: "C1",
          name: "Construct 1",
          orderIndex: 1,
        },
      },
    ],
  };
}

function createPrisma() {
  const prisma = {
    assessmentScoringRun: {
      findUnique: vi.fn(),
    },
    assessmentInterpretationSet: {
      findUnique: vi.fn(),
    },
    assessmentNormApplication: {
      findMany: vi.fn(),
    },
    assessmentInterpretationApplication: {
      findMany: vi.fn(),
    },
    assessmentReportDataSnapshot: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) =>
    callback(prisma),
  );

  return prisma;
}

describe("AssessmentReportDataService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentReportDataService;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = createPrisma();
    service = new AssessmentReportDataService(prisma as unknown as PrismaClient);

    prisma.assessmentScoringRun.findUnique.mockResolvedValue(createScoringRun());

    prisma.assessmentInterpretationSet.findUnique.mockResolvedValue({
      id: interpretationSetId,
      version: "interpret-v1",
      name: "Interpretation",
      assessmentVersionId,
      status: AssessmentInterpretationSetStatus.PUBLISHED,
    });

    prisma.assessmentNormApplication.findMany.mockResolvedValue([
      {
        id: normApplicationId,
        assessmentConstructId: constructId,
        normSetId: "99999999-9999-4999-8999-999999999999",
        normGroupId,
        constructNormTableId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        normLookupRowId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        rawScore: decimal("12"),
        standardizedScore: decimal("55"),
        percentile: decimal("72.5"),
        appliedAt: new Date("2026-08-08T08:01:00.000Z"),
      },
    ]);

    prisma.assessmentInterpretationApplication.findMany.mockResolvedValue([
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        normApplicationId,
        interpretationRuleId,
        metricValue: decimal("72.5"),
        outputData: {
          band: "documented-band",
        },
        appliedAt: new Date("2026-08-08T08:02:00.000Z"),
        interpretationRule: {
          code: "rule-1",
          metric: "PERCENTILE",
          priority: 10,
          assessmentConstructId: constructId,
        },
      },
    ]);

    prisma.assessmentReportDataSnapshot.findUnique.mockResolvedValue(null);

    prisma.assessmentReportDataSnapshot.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        ...data,
      }),
    );
  });

  it("creates a deterministic snapshot with exact version provenance", async () => {
    const result = await service.createSnapshot(scoringRunId, normGroupId, interpretationSetId);

    expect(prisma.assessmentReportDataSnapshot.create).toHaveBeenCalledTimes(1);

    const createCall = prisma.assessmentReportDataSnapshot.create.mock.calls[0]?.[0];

    expect(createCall?.data).toMatchObject({
      scoringRunId,
      assessmentVersionId,
      interpretationSetId,
      reportVersion: "report-v1",
    });

    expect(createCall?.data.inputHash).toMatch(/^[a-f0-9]{64}$/);

    expect(result.reportVersion).toBe("report-v1");
  });

  it("returns the existing snapshot when the same canonical input already exists", async () => {
    const existing = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      scoringRunId,
      assessmentVersionId,
      interpretationSetId,
      reportVersion: "report-v1",
      inputHash: "f".repeat(64),
      payload: {},
    };

    prisma.assessmentReportDataSnapshot.findUnique.mockResolvedValue(existing);

    const result = await service.createSnapshot(scoringRunId, normGroupId, interpretationSetId);

    expect(result).toBe(existing);
    expect(prisma.assessmentReportDataSnapshot.create).not.toHaveBeenCalled();
  });

  it("rejects an interpretation set from another assessment version", async () => {
    prisma.assessmentInterpretationSet.findUnique.mockResolvedValue({
      id: interpretationSetId,
      version: "interpret-v1",
      name: "Interpretation",
      assessmentVersionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      status: AssessmentInterpretationSetStatus.PUBLISHED,
    });

    await expect(
      service.createSnapshot(scoringRunId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects incomplete interpretation provenance", async () => {
    prisma.assessmentInterpretationApplication.findMany.mockResolvedValue([]);

    await expect(
      service.createSnapshot(scoringRunId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
