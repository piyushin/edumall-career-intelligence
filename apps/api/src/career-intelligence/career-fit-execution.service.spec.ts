import { ConflictException } from "@nestjs/common";
import {
  CareerFitModelStatus,
  CareerTaxonomyVersionStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { CareerFitAlgorithmRegistry } from "./career-fit-algorithm.registry";
import { CareerFitExecutionService } from "./career-fit-execution.service";

const IDS = {
  organization: "11111111-1111-4111-8111-111111111111",
  attempt: "22222222-2222-4222-8222-222222222222",
  assessmentVersion: "33333333-3333-4333-8333-333333333333",
  scoringRun: "44444444-4444-4444-8444-444444444444",
  normGroup: "55555555-5555-4555-8555-555555555555",
  normSet: "66666666-6666-4666-8666-666666666666",
  model: "77777777-7777-4777-8777-777777777777",
  taxonomyVersion: "88888888-8888-4888-8888-888888888888",
  cluster: "99999999-9999-4999-8999-999999999999",
  pathA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  pathB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  constructA: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  constructB: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  normA: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  normB: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  factorA: "12121212-1212-4212-8212-121212121212",
  factorB: "34343434-3434-4434-8434-343434343434",
  band: "56565656-5656-4656-8656-565656565656",
  run: "78787878-7878-4878-8878-787878787878",
};

const context = {
  userId: "90909090-9090-4090-8090-909090909090",
  role: MembershipRole.ORGANIZATION_ADMIN,
  organizationId: IDS.organization,
} as AuthContext;

function makeHarness(
  algorithmResults: Array<{
    careerPathId: string;
    score: string;
    evidenceData: Record<string, unknown>;
  }>,
) {
  let createdResultData: Array<{
    careerFitRunId: string;
    careerPathId: string;
    score: Prisma.Decimal;
    rank: number;
    recommendationBandId: string | null;
    evidenceData: unknown;
  }> = [];

  const pathById = new Map([
    [IDS.pathA, { code: "A-PATH", name: "Alpha Path" }],
    [IDS.pathB, { code: "B-PATH", name: "Beta Path" }],
  ]);

  const buildRun = () => ({
    id: IDS.run,
    scoringRunId: IDS.scoringRun,
    careerFitModelId: IDS.model,
    inputHash: "f".repeat(64),
    algorithmKey: "fixture-fit",
    algorithmVersion: "1",
    calculatedAt: new Date("2026-08-13T00:00:00.000Z"),
    metadata: { normGroupId: IDS.normGroup },
    results: createdResultData.map((result) => {
      const path = pathById.get(result.careerPathId)!;
      return {
        careerPathId: result.careerPathId,
        score: result.score,
        rank: result.rank,
        recommendationBandId: result.recommendationBandId,
        evidenceData: result.evidenceData,
        careerPath: {
          code: path.code,
          name: path.name,
          careerCluster: {
            id: IDS.cluster,
            code: "CLUSTER",
            name: "Cluster",
          },
        },
        recommendationBand: result.recommendationBandId
          ? { code: "HIGH", label: "High", outputData: { approved: true } }
          : null,
      };
    }),
  });

  const tx = {
    careerFitRun: {
      create: vi.fn().mockResolvedValue({ id: IDS.run }),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => buildRun()),
    },
    careerFitResult: {
      createMany: vi.fn().mockImplementation(async ({ data }) => {
        createdResultData = data;
        return { count: data.length };
      }),
    },
  };

  const prisma = {
    assessmentAttempt: {
      findFirst: vi.fn().mockResolvedValue({
        id: IDS.attempt,
        assignment: { assessmentVersionId: IDS.assessmentVersion },
        scoringRuns: [
          {
            id: IDS.scoringRun,
            scoringVersion: "score-v1",
            algorithmVersion: "explicit-option-key-v1",
            inputHash: "a".repeat(64),
            calculatedAt: new Date("2026-08-13T00:00:00.000Z"),
          },
        ],
      }),
    },
    careerFitModel: {
      findUnique: vi.fn().mockResolvedValue({
        id: IDS.model,
        assessmentVersionId: IDS.assessmentVersion,
        careerTaxonomyVersionId: IDS.taxonomyVersion,
        version: "fit-v1",
        algorithmKey: "fixture-fit",
        algorithmVersion: "1",
        sourceReference: "test fixture only",
        methodology: { fixture: true },
        status: CareerFitModelStatus.PUBLISHED,
        careerTaxonomyVersion: {
          id: IDS.taxonomyVersion,
          version: "taxonomy-v1",
          status: CareerTaxonomyVersionStatus.PUBLISHED,
        },
        factors: [
          {
            id: IDS.factorA,
            careerPathId: IDS.pathA,
            assessmentConstructId: IDS.constructA,
            weight: new Prisma.Decimal(1),
            direction: "POSITIVE",
            configuration: { metric: "PERCENTILE" },
            sourceReference: "fixture",
            orderIndex: 0,
            careerPath: {
              id: IDS.pathA,
              code: "A-PATH",
              name: "Alpha Path",
              careerTaxonomyVersionId: IDS.taxonomyVersion,
              careerCluster: { id: IDS.cluster, code: "CLUSTER", name: "Cluster" },
            },
          },
          {
            id: IDS.factorB,
            careerPathId: IDS.pathB,
            assessmentConstructId: IDS.constructB,
            weight: new Prisma.Decimal(1),
            direction: "POSITIVE",
            configuration: { metric: "PERCENTILE" },
            sourceReference: "fixture",
            orderIndex: 1,
            careerPath: {
              id: IDS.pathB,
              code: "B-PATH",
              name: "Beta Path",
              careerTaxonomyVersionId: IDS.taxonomyVersion,
              careerCluster: { id: IDS.cluster, code: "CLUSTER", name: "Cluster" },
            },
          },
        ],
        recommendationBands: [
          {
            id: IDS.band,
            code: "HIGH",
            label: "High",
            lowerBound: new Prisma.Decimal(60),
            upperBound: new Prisma.Decimal(100),
            lowerInclusive: true,
            upperInclusive: true,
            priority: 1,
            outputData: { approved: true },
          },
        ],
      }),
    },
    assessmentNormGroup: {
      findUnique: vi.fn().mockResolvedValue({
        id: IDS.normGroup,
        code: "ADULT-GENERAL",
        normSetId: IDS.normSet,
        normSet: {
          id: IDS.normSet,
          normVersion: "norm-v1",
          assessmentVersionId: IDS.assessmentVersion,
        },
      }),
    },
    assessmentNormApplication: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: IDS.normA,
          assessmentConstructId: IDS.constructA,
          rawScore: new Prisma.Decimal(10),
          standardizedScore: new Prisma.Decimal(55),
          percentile: new Prisma.Decimal(70),
        },
        {
          id: IDS.normB,
          assessmentConstructId: IDS.constructB,
          rawScore: new Prisma.Decimal(11),
          standardizedScore: new Prisma.Decimal(56),
          percentile: new Prisma.Decimal(70),
        },
      ]),
    },
    careerFitRun: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => callback(tx)),
  };

  const norms = {
    applyPublishedNormGroup: vi.fn().mockResolvedValue([]),
  };

  const algorithms = new CareerFitAlgorithmRegistry([
    {
      key: "fixture-fit",
      version: "1",
      rankOrder: "DESC",
      execute: () => algorithmResults,
    },
  ]);

  const service = new CareerFitExecutionService(
    prisma as unknown as PrismaClient,
    norms as never,
    algorithms,
  );

  return { service, norms, tx };
}

describe("CareerFitExecutionService", () => {
  it("creates an evidence-bearing deterministic run and uses path code as the tie-breaker", async () => {
    const { service, norms, tx } = makeHarness([
      { careerPathId: IDS.pathB, score: "70", evidenceData: { source: "fixture-b" } },
      { careerPathId: IDS.pathA, score: "70", evidenceData: { source: "fixture-a" } },
    ]);

    const run = await service.executeForAttempt(context, IDS.attempt, IDS.normGroup, IDS.model);

    expect(norms.applyPublishedNormGroup).toHaveBeenCalledWith(IDS.scoringRun, IDS.normGroup);
    expect(tx.careerFitResult.createMany).toHaveBeenCalledTimes(1);
    expect(run.rankedCareerPaths.map((path) => path.careerPathCode)).toEqual(["A-PATH", "B-PATH"]);
    expect(run.rankedCareerPaths[0]?.recommendationBand?.code).toBe("HIGH");
    expect(run.rankedCareerPaths[0]?.evidence).toEqual({ source: "fixture-a" });
  });

  it("rejects an algorithm result for a career path outside the published model", async () => {
    const { service } = makeHarness([
      {
        careerPathId: "10101010-1010-4010-8010-101010101010",
        score: "70",
        evidenceData: { invalid: true },
      },
    ]);

    await expect(
      service.executeForAttempt(context, IDS.attempt, IDS.normGroup, IDS.model),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
