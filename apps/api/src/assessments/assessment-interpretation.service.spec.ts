import { ConflictException } from "@nestjs/common";
import {
  AssessmentInterpretationMetric,
  AssessmentInterpretationSetStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";

const scoringRunId = "11111111-1111-4111-8111-111111111111";
const assessmentVersionId = "22222222-2222-4222-8222-222222222222";
const constructId = "33333333-3333-4333-8333-333333333333";
const normGroupId = "44444444-4444-4444-8444-444444444444";
const normApplicationId = "55555555-5555-4555-8555-555555555555";
const interpretationSetId = "66666666-6666-4666-8666-666666666666";
const ruleId = "77777777-7777-4777-8777-777777777777";

function decimal(value: string) {
  return new Prisma.Decimal(value);
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
    assessmentInterpretationRule: {
      findMany: vi.fn(),
    },
    assessmentInterpretationApplication: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) =>
    callback(prisma),
  );

  return prisma;
}

describe("AssessmentInterpretationService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentInterpretationService;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = createPrisma();

    service = new AssessmentInterpretationService(prisma as unknown as PrismaClient);

    prisma.assessmentScoringRun.findUnique.mockResolvedValue({
      id: scoringRunId,
      attempt: {
        assignment: {
          assessmentVersionId,
        },
      },
    });

    prisma.assessmentInterpretationSet.findUnique.mockResolvedValue({
      id: interpretationSetId,
      assessmentVersionId,
      status: AssessmentInterpretationSetStatus.PUBLISHED,
    });

    prisma.assessmentNormApplication.findMany.mockResolvedValue([
      {
        id: normApplicationId,
        assessmentConstructId: constructId,
        rawScore: decimal("12"),
        standardizedScore: decimal("55"),
        percentile: decimal("72.5"),
      },
    ]);

    prisma.assessmentInterpretationApplication.findUnique.mockResolvedValue(null);

    prisma.assessmentInterpretationApplication.create.mockResolvedValue({});

    prisma.assessmentInterpretationApplication.findMany.mockResolvedValue([]);
  });

  it("rejects unpublished interpretation sets", async () => {
    prisma.assessmentInterpretationSet.findUnique.mockResolvedValue({
      id: interpretationSetId,
      assessmentVersionId,
      status: AssessmentInterpretationSetStatus.DRAFT,
    });

    await expect(
      service.applyPublishedInterpretationSet(scoringRunId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("applies the unique highest-priority matching rule", async () => {
    prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
      {
        id: ruleId,
        code: "high",
        metric: AssessmentInterpretationMetric.PERCENTILE,
        lowerBound: decimal("70"),
        upperBound: decimal("80"),
        lowerInclusive: true,
        upperInclusive: true,
        priority: 10,
        outputData: {
          band: "documented-band",
        },
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        code: "low",
        metric: AssessmentInterpretationMetric.PERCENTILE,
        lowerBound: decimal("60"),
        upperBound: decimal("90"),
        lowerInclusive: true,
        upperInclusive: true,
        priority: 5,
        outputData: {
          band: "broader-band",
        },
      },
    ]);

    await service.applyPublishedInterpretationSet(scoringRunId, normGroupId, interpretationSetId);

    expect(prisma.assessmentInterpretationApplication.create).toHaveBeenCalledWith({
      data: {
        normApplicationId,
        interpretationRuleId: ruleId,
        metricValue: decimal("72.5"),
        outputData: {
          band: "documented-band",
        },
      },
    });
  });

  it("rejects equal-priority ambiguous matches", async () => {
    prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
      {
        id: ruleId,
        code: "rule-a",
        metric: AssessmentInterpretationMetric.RAW_SCORE,
        lowerBound: decimal("10"),
        upperBound: decimal("15"),
        lowerInclusive: true,
        upperInclusive: true,
        priority: 10,
        outputData: null,
      },
      {
        id: "99999999-9999-4999-8999-999999999999",
        code: "rule-b",
        metric: AssessmentInterpretationMetric.RAW_SCORE,
        lowerBound: decimal("11"),
        upperBound: decimal("14"),
        lowerInclusive: true,
        upperInclusive: true,
        priority: 10,
        outputData: null,
      },
    ]);

    await expect(
      service.applyPublishedInterpretationSet(scoringRunId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects when no rule matches", async () => {
    prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
      {
        id: ruleId,
        code: "outside",
        metric: AssessmentInterpretationMetric.PERCENTILE,
        lowerBound: decimal("90"),
        upperBound: decimal("100"),
        lowerInclusive: true,
        upperInclusive: true,
        priority: 1,
        outputData: null,
      },
    ]);

    await expect(
      service.applyPublishedInterpretationSet(scoringRunId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a rule whose required metric is unavailable", async () => {
    prisma.assessmentNormApplication.findMany.mockResolvedValue([
      {
        id: normApplicationId,
        assessmentConstructId: constructId,
        rawScore: decimal("12"),
        standardizedScore: null,
        percentile: null,
      },
    ]);

    prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
      {
        id: ruleId,
        code: "needs-percentile",
        metric: AssessmentInterpretationMetric.PERCENTILE,
        lowerBound: null,
        upperBound: null,
        lowerInclusive: true,
        upperInclusive: true,
        priority: 1,
        outputData: null,
      },
    ]);

    await expect(
      service.applyPublishedInterpretationSet(scoringRunId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
