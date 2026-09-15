import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  AssessmentInterpretationMetric,
  AssessmentInterpretationSetStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentInterpretationAdminService } from "./assessment-interpretation-admin.service";

const organizationId = "44444444-4444-4444-8444-444444444444";

const organizationContext: AuthContext = {
  userId: "55555555-5555-4555-8555-555555555555",
  organizationId,
  membershipId: "66666666-6666-4666-8666-666666666666",
  role: MembershipRole.ORGANIZATION_ADMIN,
  sessionId: "77777777-7777-4777-8777-777777777777",
};

const definitionId = "88888888-8888-4888-8888-888888888888";
const versionId = "99999999-9999-4999-8999-999999999999";
const interpretationSetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const constructId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createPrisma() {
  const prisma = {
    assessmentVersion: {
      findUnique: vi.fn(),
    },
    assessmentConstruct: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentInterpretationSet: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    assessmentInterpretationRule: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };

  return {
    ...prisma,
    $transaction: vi.fn(async (callback: (client: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    ),
  };
}

function ownedVersion(orgId: string | null = organizationId) {
  return {
    id: versionId,
    assessmentDefinitionId: definitionId,
    assessmentDefinition: { organizationId: orgId },
  };
}

function draftInterpretationSet() {
  return {
    id: interpretationSetId,
    assessmentVersionId: versionId,
    version: "v1",
    name: "Pilot interpretation",
    description: null,
    sourceReference: null,
    methodology: null,
    status: AssessmentInterpretationSetStatus.DRAFT,
    publishedAt: null,
    retiredAt: null,
    createdAt: new Date(),
  };
}

describe("AssessmentInterpretationAdminService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentInterpretationAdminService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentInterpretationAdminService(prisma as unknown as PrismaClient);
  });

  it("rejects an organization admin acting outside their own organization", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion("other-org"));

    await expect(
      service.createInterpretationSet(organizationContext, definitionId, versionId, {
        version: "v1",
        name: "Pilot interpretation",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns not found when the version does not belong to the requested definition", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      ...ownedVersion(),
      assessmentDefinitionId: "wrong-definition",
    });

    await expect(
      service.createInterpretationSet(organizationContext, definitionId, versionId, {
        version: "v1",
        name: "Pilot interpretation",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates an interpretation set scoped to the owned version", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentInterpretationSet.create.mockResolvedValue(draftInterpretationSet());

    await service.createInterpretationSet(organizationContext, definitionId, versionId, {
      version: " v1 ",
      name: " Pilot interpretation ",
    });

    expect(prisma.assessmentInterpretationSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assessmentVersionId: versionId,
          version: "v1",
          name: "Pilot interpretation",
        }),
      }),
    );
  });

  it("translates a duplicate interpretation version into a conflict", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentInterpretationSet.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.createInterpretationSet(organizationContext, definitionId, versionId, {
        version: "v1",
        name: "Pilot interpretation",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe("createInterpretationRule", () => {
    it("blocks authoring against an interpretation set that is no longer draft", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue({
        ...draftInterpretationSet(),
        status: AssessmentInterpretationSetStatus.PUBLISHED,
      });

      await expect(
        service.createInterpretationRule(
          organizationContext,
          definitionId,
          versionId,
          interpretationSetId,
          {
            assessmentConstructId: constructId,
            code: "LOW",
            metric: AssessmentInterpretationMetric.STANDARDIZED_SCORE,
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.assessmentInterpretationRule.create).not.toHaveBeenCalled();
    });

    it("rejects an inverted bound range", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());

      await expect(
        service.createInterpretationRule(
          organizationContext,
          definitionId,
          versionId,
          interpretationSetId,
          {
            assessmentConstructId: constructId,
            code: "LOW",
            metric: AssessmentInterpretationMetric.STANDARDIZED_SCORE,
            lowerBound: 100,
            upperBound: 0,
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.assessmentInterpretationRule.create).not.toHaveBeenCalled();
    });

    it("rejects a construct that does not belong to this assessment version", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());
      prisma.assessmentConstruct.findFirst.mockResolvedValue(null);

      await expect(
        service.createInterpretationRule(
          organizationContext,
          definitionId,
          versionId,
          interpretationSetId,
          {
            assessmentConstructId: constructId,
            code: "LOW",
            metric: AssessmentInterpretationMetric.STANDARDIZED_SCORE,
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a same-priority range that overlaps an existing rule for the same construct+metric", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());
      prisma.assessmentConstruct.findFirst.mockResolvedValue({ id: constructId });
      prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
        {
          code: "AVERAGE",
          lowerBound: new Prisma.Decimal(40),
          upperBound: new Prisma.Decimal(60),
          lowerInclusive: true,
          upperInclusive: true,
        },
      ]);

      await expect(
        service.createInterpretationRule(
          organizationContext,
          definitionId,
          versionId,
          interpretationSetId,
          {
            assessmentConstructId: constructId,
            code: "HIGH",
            metric: AssessmentInterpretationMetric.STANDARDIZED_SCORE,
            lowerBound: 50,
            upperBound: 100,
          },
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.assessmentInterpretationRule.create).not.toHaveBeenCalled();
    });

    it("allows a higher-priority rule to overlap a lower-priority one", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());
      prisma.assessmentConstruct.findFirst.mockResolvedValue({ id: constructId });
      // The same-priority query only returns rules that share this new rule's priority
      // (10); a lower-priority overlapping rule at priority 0 is a different bucket and
      // must not block creation.
      prisma.assessmentInterpretationRule.findMany.mockResolvedValue([]);
      prisma.assessmentInterpretationRule.create.mockResolvedValue({});

      await service.createInterpretationRule(
        organizationContext,
        definitionId,
        versionId,
        interpretationSetId,
        {
          assessmentConstructId: constructId,
          code: "OVERRIDE",
          metric: AssessmentInterpretationMetric.STANDARDIZED_SCORE,
          lowerBound: 50,
          upperBound: 60,
          priority: 10,
        },
      );

      expect(prisma.assessmentInterpretationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ priority: 10 }),
        }),
      );
      expect(prisma.assessmentInterpretationRule.create).toHaveBeenCalled();
    });

    it("accepts a non-overlapping range at the same priority", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());
      prisma.assessmentConstruct.findFirst.mockResolvedValue({ id: constructId });
      prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
        {
          code: "LOW",
          lowerBound: null,
          upperBound: new Prisma.Decimal(40),
          lowerInclusive: true,
          upperInclusive: false,
        },
      ]);
      prisma.assessmentInterpretationRule.create.mockResolvedValue({});

      await service.createInterpretationRule(
        organizationContext,
        definitionId,
        versionId,
        interpretationSetId,
        {
          assessmentConstructId: constructId,
          code: "HIGH",
          metric: AssessmentInterpretationMetric.STANDARDIZED_SCORE,
          lowerBound: 40,
        },
      );

      expect(prisma.assessmentInterpretationRule.create).toHaveBeenCalled();
    });
  });

  describe("publication readiness", () => {
    it("flags every construct without an interpretation rule", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());
      prisma.assessmentConstruct.findMany.mockResolvedValue([
        { id: constructId, code: "APT" },
        { id: "other-construct", code: "VERB" },
      ]);
      prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
        { assessmentConstructId: constructId },
      ]);

      const readiness = await service.getPublicationReadiness(
        organizationContext,
        definitionId,
        versionId,
        interpretationSetId,
      );

      expect(readiness.ready).toBe(false);
      expect(readiness.issues).toContainEqual(
        expect.objectContaining({
          code: "ASSESSMENT_INTERPRETATION_RULE_MISSING_FOR_CONSTRUCT",
          constructId: "other-construct",
        }),
      );
    });

    it("is ready once every construct has at least one rule", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());
      prisma.assessmentConstruct.findMany.mockResolvedValue([{ id: constructId, code: "APT" }]);
      prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
        { assessmentConstructId: constructId },
      ]);

      const readiness = await service.getPublicationReadiness(
        organizationContext,
        definitionId,
        versionId,
        interpretationSetId,
      );

      expect(readiness.ready).toBe(true);
      expect(readiness.issues).toHaveLength(0);
    });
  });

  it("refuses to publish a second interpretation set while one is already published", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentInterpretationSet.findFirst
      .mockResolvedValueOnce(draftInterpretationSet())
      .mockResolvedValueOnce({ id: "other-set", version: "v0" });
    prisma.assessmentConstruct.findMany.mockResolvedValue([]);
    prisma.assessmentInterpretationRule.findMany.mockResolvedValue([]);

    await expect(
      service.publishInterpretationSet(
        organizationContext,
        definitionId,
        versionId,
        interpretationSetId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentInterpretationSet.update).not.toHaveBeenCalled();
  });

  it("publishes once readiness passes and nothing else is published", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentInterpretationSet.findFirst
      .mockResolvedValueOnce(draftInterpretationSet())
      .mockResolvedValueOnce(null);
    prisma.assessmentConstruct.findMany.mockResolvedValue([{ id: constructId, code: "APT" }]);
    prisma.assessmentInterpretationRule.findMany.mockResolvedValue([
      { assessmentConstructId: constructId },
    ]);
    prisma.assessmentInterpretationSet.update.mockResolvedValue({
      ...draftInterpretationSet(),
      status: AssessmentInterpretationSetStatus.PUBLISHED,
    });

    await service.publishInterpretationSet(
      organizationContext,
      definitionId,
      versionId,
      interpretationSetId,
    );

    expect(prisma.assessmentInterpretationSet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: interpretationSetId },
        data: expect.objectContaining({ status: AssessmentInterpretationSetStatus.PUBLISHED }),
      }),
    );
  });

  it("only retires a published interpretation set", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentInterpretationSet.findFirst.mockResolvedValue(draftInterpretationSet());

    await expect(
      service.retireInterpretationSet(
        organizationContext,
        definitionId,
        versionId,
        interpretationSetId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentInterpretationSet.update).not.toHaveBeenCalled();
  });
});
