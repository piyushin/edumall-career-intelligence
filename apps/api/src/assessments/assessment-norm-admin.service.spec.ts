import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AssessmentNormSetStatus, MembershipRole, Prisma, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentNormAdminService } from "./assessment-norm-admin.service";

const platformContext: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: null,
  membershipId: "22222222-2222-4222-8222-222222222222",
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "33333333-3333-4333-8333-333333333333",
};

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
const normSetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const normGroupId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const constructId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tableId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function createPrisma() {
  const prisma = {
    assessmentVersion: {
      findUnique: vi.fn(),
    },
    assessmentConstruct: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentNormSet: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    assessmentNormGroup: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentConstructNormTable: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    assessmentNormLookupRow: {
      create: vi.fn(),
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
    normVersion: "v1",
    assessmentDefinition: { organizationId: orgId },
  };
}

function draftNormSet() {
  return {
    id: normSetId,
    assessmentVersionId: versionId,
    normVersion: "v1",
    name: "Pilot norms",
    description: null,
    sourceReference: null,
    populationMetadata: null,
    status: AssessmentNormSetStatus.DRAFT,
    publishedAt: null,
    retiredAt: null,
    createdAt: new Date(),
  };
}

describe("AssessmentNormAdminService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentNormAdminService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentNormAdminService(prisma as unknown as PrismaClient);
  });

  it("rejects an organization admin acting outside their own organization", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion("other-org"));

    await expect(
      service.createNormSet(organizationContext, definitionId, versionId, {
        normVersion: "v1",
        name: "Pilot norms",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentNormSet.create).not.toHaveBeenCalled();
  });

  it("rejects a platform admin acting on an organization-owned definition", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion(organizationId));

    await expect(
      service.createNormSet(platformContext, definitionId, versionId, {
        normVersion: "v1",
        name: "Pilot norms",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns not found when the version does not belong to the requested definition", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      ...ownedVersion(),
      assessmentDefinitionId: "wrong-definition",
    });

    await expect(
      service.createNormSet(organizationContext, definitionId, versionId, {
        normVersion: "v1",
        name: "Pilot norms",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates a norm set scoped to the owned version", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.create.mockResolvedValue(draftNormSet());

    await service.createNormSet(organizationContext, definitionId, versionId, {
      normVersion: " v1 ",
      name: " Pilot norms ",
    });

    expect(prisma.assessmentNormSet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assessmentVersionId: versionId,
          normVersion: "v1",
          name: "Pilot norms",
        }),
      }),
    );
  });

  it("rejects a norm set whose normVersion does not match the assessment version's", async () => {
    // Regression test: this is exactly what the DB's assessment_norm_set_version_guard
    // trigger enforces (a norm set is only ever picked up by
    // AssessmentReportPipelineService when its normVersion matches the assessment
    // version's own normVersion field), but the trigger raises a bare Postgres
    // exception with no error code -- letting it reach the database produced an
    // unhandled PrismaClientUnknownRequestError and a 500 for the caller instead of a
    // clear validation error. Confirmed live: creating a norm set with a normVersion
    // that didn't match the assessment version's normVersion field threw exactly this
    // through the real API.
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());

    await expect(
      service.createNormSet(organizationContext, definitionId, versionId, {
        normVersion: "v2-does-not-match",
        name: "Mismatched norms",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentNormSet.create).not.toHaveBeenCalled();
  });

  it("translates a duplicate norm version into a conflict", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.createNormSet(organizationContext, definitionId, versionId, {
        normVersion: "v1",
        name: "Pilot norms",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks authoring against a norm set that is no longer draft", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue({
      ...draftNormSet(),
      status: AssessmentNormSetStatus.PUBLISHED,
    });

    await expect(
      service.createNormGroup(organizationContext, definitionId, versionId, normSetId, {
        code: "GENERAL",
        name: "General population",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentNormGroup.create).not.toHaveBeenCalled();
  });

  it("rejects a norm lookup row whose max is below its min", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
    prisma.assessmentConstructNormTable.findFirst.mockResolvedValue({
      id: tableId,
      rows: [],
    });

    await expect(
      service.createNormLookupRow(
        organizationContext,
        definitionId,
        versionId,
        normSetId,
        normGroupId,
        tableId,
        { rawScoreMin: 10, rawScoreMax: 5 },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentNormLookupRow.create).not.toHaveBeenCalled();
  });

  it("rejects a norm lookup row that overlaps an existing row in the same table", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
    prisma.assessmentConstructNormTable.findFirst.mockResolvedValue({
      id: tableId,
      rows: [{ rawScoreMin: new Prisma.Decimal(0), rawScoreMax: new Prisma.Decimal(10) }],
    });

    await expect(
      service.createNormLookupRow(
        organizationContext,
        definitionId,
        versionId,
        normSetId,
        normGroupId,
        tableId,
        { rawScoreMin: 8, rawScoreMax: 15 },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentNormLookupRow.create).not.toHaveBeenCalled();
  });

  it("accepts a norm lookup row in a disjoint range", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
    prisma.assessmentConstructNormTable.findFirst.mockResolvedValue({
      id: tableId,
      rows: [{ rawScoreMin: new Prisma.Decimal(0), rawScoreMax: new Prisma.Decimal(10) }],
    });
    prisma.assessmentNormLookupRow.create.mockResolvedValue({});

    await service.createNormLookupRow(
      organizationContext,
      definitionId,
      versionId,
      normSetId,
      normGroupId,
      tableId,
      { rawScoreMin: 11, rawScoreMax: 20 },
    );

    expect(prisma.assessmentNormLookupRow.create).toHaveBeenCalled();
  });

  describe("publication readiness", () => {
    it("flags a norm set with no groups as not ready", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
      prisma.assessmentConstruct.findMany.mockResolvedValue([{ id: constructId, code: "APT" }]);
      prisma.assessmentNormGroup.findMany.mockResolvedValue([]);

      const readiness = await service.getPublicationReadiness(
        organizationContext,
        definitionId,
        versionId,
        normSetId,
      );

      expect(readiness.ready).toBe(false);
      expect(readiness.issues).toContainEqual(
        expect.objectContaining({ code: "ASSESSMENT_NORM_SET_HAS_NO_GROUP" }),
      );
    });

    it("flags a norm set with more than one group (V1 single-group assumption)", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
      prisma.assessmentConstruct.findMany.mockResolvedValue([]);
      prisma.assessmentNormGroup.findMany.mockResolvedValue([
        { id: "group-1", code: "A", constructTables: [] },
        { id: "group-2", code: "B", constructTables: [] },
      ]);

      const readiness = await service.getPublicationReadiness(
        organizationContext,
        definitionId,
        versionId,
        normSetId,
      );

      expect(readiness.ready).toBe(false);
      expect(readiness.issues).toContainEqual(
        expect.objectContaining({ code: "ASSESSMENT_NORM_SET_HAS_MULTIPLE_GROUPS" }),
      );
    });

    it("flags a construct with no norm table and a table with no rows", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
      prisma.assessmentConstruct.findMany.mockResolvedValue([
        { id: constructId, code: "APT" },
        { id: "other-construct", code: "VERB" },
      ]);
      prisma.assessmentNormGroup.findMany.mockResolvedValue([
        {
          id: normGroupId,
          code: "GENERAL",
          constructTables: [{ assessmentConstructId: constructId, rows: [] }],
        },
      ]);

      const readiness = await service.getPublicationReadiness(
        organizationContext,
        definitionId,
        versionId,
        normSetId,
      );

      expect(readiness.ready).toBe(false);
      expect(readiness.issues).toContainEqual(
        expect.objectContaining({ code: "ASSESSMENT_NORM_TABLE_HAS_NO_ROWS", constructId }),
      );
      expect(readiness.issues).toContainEqual(
        expect.objectContaining({
          code: "ASSESSMENT_NORM_TABLE_MISSING",
          constructId: "other-construct",
        }),
      );
    });

    it("is ready when every construct has a table with at least one row", async () => {
      prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
      prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
      prisma.assessmentConstruct.findMany.mockResolvedValue([{ id: constructId, code: "APT" }]);
      prisma.assessmentNormGroup.findMany.mockResolvedValue([
        {
          id: normGroupId,
          code: "GENERAL",
          constructTables: [{ assessmentConstructId: constructId, rows: [{ id: "row-1" }] }],
        },
      ]);

      const readiness = await service.getPublicationReadiness(
        organizationContext,
        definitionId,
        versionId,
        normSetId,
      );

      expect(readiness.ready).toBe(true);
      expect(readiness.issues).toHaveLength(0);
    });
  });

  it("refuses to publish when readiness checks fail", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
    prisma.assessmentConstruct.findMany.mockResolvedValue([{ id: constructId, code: "APT" }]);
    prisma.assessmentNormGroup.findMany.mockResolvedValue([]);

    await expect(
      service.publishNormSet(organizationContext, definitionId, versionId, normSetId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentNormSet.update).not.toHaveBeenCalled();
  });

  it("publishes a norm set once every readiness check passes", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());
    prisma.assessmentConstruct.findMany.mockResolvedValue([{ id: constructId, code: "APT" }]);
    prisma.assessmentNormGroup.findMany.mockResolvedValue([
      {
        id: normGroupId,
        code: "GENERAL",
        constructTables: [{ assessmentConstructId: constructId, rows: [{ id: "row-1" }] }],
      },
    ]);
    prisma.assessmentNormSet.update.mockResolvedValue({
      ...draftNormSet(),
      status: AssessmentNormSetStatus.PUBLISHED,
    });

    await service.publishNormSet(organizationContext, definitionId, versionId, normSetId);

    expect(prisma.assessmentNormSet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: normSetId },
        data: expect.objectContaining({ status: AssessmentNormSetStatus.PUBLISHED }),
      }),
    );
  });

  it("only retires a published norm set", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue(ownedVersion());
    prisma.assessmentNormSet.findFirst.mockResolvedValue(draftNormSet());

    await expect(
      service.retireNormSet(organizationContext, definitionId, versionId, normSetId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentNormSet.update).not.toHaveBeenCalled();
  });
});
