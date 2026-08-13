import { ForbiddenException } from "@nestjs/common";
import {
  AssessmentVersionStatus,
  CareerFitModelStatus,
  CareerTaxonomyStatus,
  CareerTaxonomyVersionStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { CareerFitAlgorithmRegistry } from "./career-fit-algorithm.registry";
import { CareerIntelligenceAdminService } from "./career-intelligence-admin.service";

const superAdmin = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: MembershipRole.SUPER_ADMIN,
  organizationId: null,
} as AuthContext;

function makeService(
  prisma: Record<string, unknown>,
  algorithms = new CareerFitAlgorithmRegistry([]),
) {
  return new CareerIntelligenceAdminService(prisma as unknown as PrismaClient, algorithms);
}

describe("CareerIntelligenceAdminService", () => {
  it("keeps taxonomy and fit-model governance platform-admin only", () => {
    const service = makeService({
      careerTaxonomy: {
        findMany: vi.fn(),
      },
    });

    const organizationAdmin = {
      userId: "22222222-2222-4222-8222-222222222222",
      role: MembershipRole.ORGANIZATION_ADMIN,
      organizationId: "33333333-3333-4333-8333-333333333333",
    } as AuthContext;

    expect(() => service.listTaxonomies(organizationAdmin)).toThrow(ForbiddenException);
  });

  it("blocks taxonomy publication when provenance or career content is incomplete", async () => {
    const versionId = "44444444-4444-4444-8444-444444444444";
    const taxonomyId = "55555555-5555-4555-8555-555555555555";
    const findFirst = vi.fn().mockResolvedValue({
      id: versionId,
      careerTaxonomyId: taxonomyId,
      status: CareerTaxonomyVersionStatus.DRAFT,
    });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: versionId,
      status: CareerTaxonomyVersionStatus.DRAFT,
      sourceReference: null,
      methodology: null,
      careerTaxonomy: {
        status: CareerTaxonomyStatus.ACTIVE,
      },
      clusters: [],
    });

    const service = makeService({
      careerTaxonomyVersion: {
        findFirst,
        findUniqueOrThrow,
      },
    });

    const readiness = await service.getTaxonomyPublicationReadiness(
      superAdmin,
      taxonomyId,
      versionId,
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "CAREER_TAXONOMY_SOURCE_REFERENCE_REQUIRED",
        "CAREER_TAXONOMY_METHODOLOGY_REQUIRED",
        "CAREER_TAXONOMY_HAS_NO_CLUSTERS",
        "CAREER_TAXONOMY_HAS_NO_PATHS",
      ]),
    );
  });

  it("blocks fit-model publication until the configured algorithm is registered", async () => {
    const modelId = "66666666-6666-4666-8666-666666666666";
    const assessmentVersionId = "77777777-7777-4777-8777-777777777777";
    const taxonomyVersionId = "88888888-8888-4888-8888-888888888888";

    const service = makeService({
      careerFitModel: {
        findUnique: vi.fn().mockResolvedValue({
          id: modelId,
          status: CareerFitModelStatus.DRAFT,
          assessmentVersionId,
          careerTaxonomyVersionId: taxonomyVersionId,
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: modelId,
          status: CareerFitModelStatus.DRAFT,
          algorithmKey: "not-yet-approved",
          algorithmVersion: "1",
          sourceReference: "Scientific mapping package pending approval",
          methodology: { status: "draft" },
          assessmentVersionId,
          careerTaxonomyVersionId: taxonomyVersionId,
          assessmentVersion: {
            status: AssessmentVersionStatus.PUBLISHED,
          },
          careerTaxonomyVersion: {
            status: CareerTaxonomyVersionStatus.PUBLISHED,
          },
          factors: [],
          recommendationBands: [],
        }),
      },
    });

    const readiness = await service.getFitModelPublicationReadiness(superAdmin, modelId);

    expect(readiness.ready).toBe(false);
    expect(readiness.algorithmRegistered).toBe(false);
    expect(readiness.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "CAREER_FIT_MODEL_HAS_NO_FACTORS",
        "CAREER_FIT_ALGORITHM_NOT_REGISTERED",
      ]),
    );
  });

  it("rejects overlapping recommendation bands even for a registered algorithm", async () => {
    const modelId = "99999999-9999-4999-8999-999999999999";
    const assessmentVersionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const taxonomyVersionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const algorithms = new CareerFitAlgorithmRegistry([
      { key: "approved-fit", version: "1", rankOrder: "DESC", execute: () => [] },
    ]);

    const service = makeService(
      {
        careerFitModel: {
          findUnique: vi.fn().mockResolvedValue({
            id: modelId,
            status: CareerFitModelStatus.DRAFT,
            assessmentVersionId,
            careerTaxonomyVersionId: taxonomyVersionId,
          }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: modelId,
            status: CareerFitModelStatus.DRAFT,
            algorithmKey: "approved-fit",
            algorithmVersion: "1",
            sourceReference: "approved source",
            methodology: { approved: true },
            assessmentVersionId,
            careerTaxonomyVersionId: taxonomyVersionId,
            assessmentVersion: {
              status: AssessmentVersionStatus.PUBLISHED,
            },
            careerTaxonomyVersion: {
              status: CareerTaxonomyVersionStatus.PUBLISHED,
            },
            factors: [
              {
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                careerPathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
                assessmentConstructId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                weight: new Prisma.Decimal(1),
                direction: "POSITIVE",
                configuration: null,
                rationale: "approved rationale",
                sourceReference: "approved factor source",
                careerPath: {
                  careerTaxonomyVersionId: taxonomyVersionId,
                },
                assessmentConstruct: {
                  assessmentVersionId,
                },
              },
            ],
            recommendationBands: [
              {
                id: "11111111-2222-4333-8444-555555555555",
                code: "A",
                lowerBound: new Prisma.Decimal(0),
                upperBound: new Prisma.Decimal(60),
                lowerInclusive: true,
                upperInclusive: true,
                priority: 1,
                outputData: null,
              },
              {
                id: "22222222-3333-4444-8555-666666666666",
                code: "B",
                lowerBound: new Prisma.Decimal(60),
                upperBound: new Prisma.Decimal(100),
                lowerInclusive: true,
                upperInclusive: true,
                priority: 2,
                outputData: null,
              },
            ],
          }),
        },
      },
      algorithms,
    );

    const readiness = await service.getFitModelPublicationReadiness(superAdmin, modelId);

    expect(readiness.ready).toBe(false);
    expect(readiness.algorithmRegistered).toBe(true);
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "CAREER_FIT_RECOMMENDATION_BANDS_OVERLAP",
    );
  });
});
