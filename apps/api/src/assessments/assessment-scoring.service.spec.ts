import { ConflictException } from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  AssessmentItemType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentScoringService } from "./assessment-scoring.service";

const attemptId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const optionId = "33333333-3333-4333-8333-333333333333";
const constructId = "44444444-4444-4444-8444-444444444444";
const scoringRunId = "55555555-5555-4555-8555-555555555555";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function submittedAttempt(): {
  id: string;
  status: AssessmentAttemptStatus;
  assignment: {
    assessmentVersion: {
      scoringVersion: string;
    };
  };
  responses: Array<{
    itemId: string;
    item: {
      type: AssessmentItemType;
      constructLinks: Array<{
        assessmentConstructId: string;
        weight: Prisma.Decimal;
        reverseScored: boolean;
      }>;
    };
    selections: Array<{
      optionId: string;
      option: {
        scores: Array<{
          assessmentConstructId: string;
          score: Prisma.Decimal;
        }>;
      };
    }>;
  }>;
} {
  return {
    id: attemptId,
    status: AssessmentAttemptStatus.SUBMITTED,
    assignment: {
      assessmentVersion: {
        scoringVersion: "scoring-v1",
      },
    },
    responses: [
      {
        itemId,
        item: {
          type: AssessmentItemType.SINGLE_CHOICE,
          constructLinks: [
            {
              assessmentConstructId: constructId,
              weight: decimal("2.0000"),
              reverseScored: false,
            },
          ],
        },
        selections: [
          {
            optionId,
            option: {
              scores: [
                {
                  assessmentConstructId: constructId,
                  score: decimal("3.0000"),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function scoringRun() {
  return {
    id: scoringRunId,
    attemptId,
    scoringVersion: "scoring-v1",
    algorithmVersion: "explicit-option-key-v1",
    inputHash: "a".repeat(64),
    calculatedAt: new Date(),
    constructScores: [
      {
        assessmentConstructId: constructId,
        rawScore: decimal("6.00000000"),
        answeredItemCount: 1,
        contributionCount: 1,
      },
    ],
  };
}

function createPrisma() {
  const prisma = {
    assessmentAttempt: {
      findUnique: vi.fn(),
    },
    assessmentScoringRun: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    assessmentConstructScore: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) =>
    callback(prisma),
  );

  return prisma;
}

describe("AssessmentScoringService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentScoringService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrisma();
    service = new AssessmentScoringService(prisma as unknown as PrismaClient);
  });

  it("rejects scoring before submission", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue({
      ...submittedAttempt(),
      status: AssessmentAttemptStatus.IN_PROGRESS,
    });

    await expect(service.scoreSubmittedAttempt(attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("creates deterministic weighted raw construct scores", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(submittedAttempt());

    prisma.assessmentScoringRun.findUnique.mockResolvedValue(null);

    prisma.assessmentScoringRun.create.mockResolvedValue({
      id: scoringRunId,
    });

    prisma.assessmentConstructScore.createMany.mockResolvedValue({
      count: 1,
    });

    prisma.assessmentScoringRun.findUniqueOrThrow.mockResolvedValue(scoringRun());

    await service.scoreSubmittedAttempt(attemptId);

    expect(prisma.assessmentConstructScore.createMany).toHaveBeenCalledWith({
      data: [
        {
          scoringRunId,
          assessmentConstructId: constructId,
          rawScore: "6.00000000",
          answeredItemCount: 1,
          contributionCount: 1,
        },
      ],
    });
  });

  it("returns an identical scoring run idempotently", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(submittedAttempt());

    prisma.assessmentScoringRun.findUnique.mockResolvedValue(scoringRun());

    const result = await service.scoreSubmittedAttempt(attemptId);

    expect(result.id).toBe(scoringRunId);
    expect(prisma.assessmentScoringRun.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported scalar scoring", async () => {
    const attempt = submittedAttempt();

    attempt.responses[0]!.item.type = AssessmentItemType.NUMERIC;
    attempt.responses[0]!.selections = [];

    prisma.assessmentAttempt.findUnique.mockResolvedValue(attempt);

    await expect(service.scoreSubmittedAttempt(attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("rejects incomplete explicit option scoring", async () => {
    const attempt = submittedAttempt();

    attempt.responses[0]!.selections[0]!.option.scores = [];

    prisma.assessmentAttempt.findUnique.mockResolvedValue(attempt);

    await expect(service.scoreSubmittedAttempt(attemptId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
