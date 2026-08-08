import { ConflictException } from "@nestjs/common";
import { AssessmentNormSetStatus, Prisma, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssessmentNormService } from "./assessment-norm.service";

const scoringRunId = "11111111-1111-4111-8111-111111111111";
const assessmentVersionId = "22222222-2222-4222-8222-222222222222";
const constructId = "33333333-3333-4333-8333-333333333333";
const normSetId = "44444444-4444-4444-8444-444444444444";
const normGroupId = "55555555-5555-4555-8555-555555555555";
const tableId = "66666666-6666-4666-8666-666666666666";
const rowId = "77777777-7777-4777-8777-777777777777";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createScoringRun() {
  return {
    id: scoringRunId,
    attempt: {
      assignment: {
        assessmentVersionId,
        assessmentVersion: {
          normVersion: "norm-v1",
        },
      },
    },
    constructScores: [
      {
        assessmentConstructId: constructId,
        rawScore: decimal("12.00000000"),
      },
    ],
  };
}

function createNormGroup(status: AssessmentNormSetStatus = AssessmentNormSetStatus.PUBLISHED) {
  return {
    id: normGroupId,
    normSetId,
    normSet: {
      assessmentVersionId,
      normVersion: "norm-v1",
      status,
    },
  };
}

function createPrisma() {
  const prisma = {
    assessmentScoringRun: {
      findUnique: vi.fn(),
    },
    assessmentNormGroup: {
      findUnique: vi.fn(),
    },
    assessmentConstructNormTable: {
      findUnique: vi.fn(),
    },
    assessmentNormLookupRow: {
      findMany: vi.fn(),
    },
    assessmentNormApplication: {
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

describe("AssessmentNormService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentNormService;

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = createPrisma();

    service = new AssessmentNormService(prisma as unknown as PrismaClient);

    prisma.assessmentScoringRun.findUnique.mockResolvedValue(createScoringRun());

    prisma.assessmentNormGroup.findUnique.mockResolvedValue(createNormGroup());

    prisma.assessmentNormApplication.findUnique.mockResolvedValue(null);

    prisma.assessmentConstructNormTable.findUnique.mockResolvedValue({
      id: tableId,
    });

    prisma.assessmentNormApplication.create.mockResolvedValue({});

    prisma.assessmentNormApplication.findMany.mockResolvedValue([]);
  });

  it("rejects unpublished norm sets", async () => {
    prisma.assessmentNormGroup.findUnique.mockResolvedValue(
      createNormGroup(AssessmentNormSetStatus.DRAFT),
    );

    await expect(service.applyPublishedNormGroup(scoringRunId, normGroupId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("rejects raw scores with no matching norm interval", async () => {
    prisma.assessmentNormLookupRow.findMany.mockResolvedValue([]);

    await expect(service.applyPublishedNormGroup(scoringRunId, normGroupId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("rejects overlapping norm lookup intervals", async () => {
    prisma.assessmentNormLookupRow.findMany.mockResolvedValue([
      {
        id: rowId,
        standardizedScore: decimal("50"),
        percentile: decimal("50"),
      },
      {
        id: "88888888-8888-4888-8888-888888888888",
        standardizedScore: decimal("51"),
        percentile: decimal("52"),
      },
    ]);

    await expect(service.applyPublishedNormGroup(scoringRunId, normGroupId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("persists exact values from the unique matching lookup row", async () => {
    prisma.assessmentNormLookupRow.findMany.mockResolvedValue([
      {
        id: rowId,
        standardizedScore: decimal("55.00000000"),
        percentile: decimal("72.5000"),
      },
    ]);

    await service.applyPublishedNormGroup(scoringRunId, normGroupId);

    expect(prisma.assessmentNormApplication.create).toHaveBeenCalledWith({
      data: {
        scoringRunId,
        assessmentConstructId: constructId,
        normSetId,
        normGroupId,
        constructNormTableId: tableId,
        normLookupRowId: rowId,
        rawScore: decimal("12.00000000"),
        standardizedScore: decimal("55.00000000"),
        percentile: decimal("72.5000"),
      },
    });
  });
});
