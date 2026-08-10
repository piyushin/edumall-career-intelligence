import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  AssessmentItemType,
  AssessmentVersionStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentAdminService } from "./assessment-admin.service";

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

function createPrisma() {
  return {
    assessmentDefinition: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    assessmentVersion: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    assessmentConstruct: {
      create: vi.fn(),
    },
    assessmentItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    assessmentItemOption: {
      create: vi.fn(),
    },
  };
}

describe("AssessmentAdminService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentAdminService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentAdminService(prisma as unknown as PrismaClient);
  });

  it("lets a platform super admin list definitions without organization restriction", async () => {
    prisma.assessmentDefinition.findMany.mockResolvedValue([]);

    await service.listDefinitions(platformContext);

    expect(prisma.assessmentDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it("limits organization admin reads to platform-owned and own-organization definitions", async () => {
    prisma.assessmentDefinition.findMany.mockResolvedValue([]);

    await service.listDefinitions(organizationContext);

    expect(prisma.assessmentDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ organizationId: null }, { organizationId }],
        },
      }),
    );
  });

  it("creates organization-owned definitions for organization admins", async () => {
    prisma.assessmentDefinition.create.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
      organizationId,
      code: "CAREER_TEST",
      status: "ACTIVE",
      createdAt: new Date(),
    });

    await service.createDefinition(organizationContext, {
      code: " CAREER_TEST ",
    });

    expect(prisma.assessmentDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          code: "CAREER_TEST",
          createdByUserId: organizationContext.userId,
        }),
      }),
    );
  });

  it("creates platform-owned definitions for platform super admins", async () => {
    prisma.assessmentDefinition.create.mockResolvedValue({
      id: "99999999-9999-4999-8999-999999999999",
      organizationId: null,
      code: "GLOBAL_TEST",
      status: "ACTIVE",
      createdAt: new Date(),
    });

    await service.createDefinition(platformContext, {
      code: "GLOBAL_TEST",
    });

    expect(prisma.assessmentDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: null,
          createdByUserId: platformContext.userId,
        }),
      }),
    );
  });

  it("blocks an organization admin from versioning a platform-owned definition", async () => {
    prisma.assessmentDefinition.findUnique.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organizationId: null,
    });

    await expect(
      service.createDraftVersion(organizationContext, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", {
        versionNumber: 1,
        title: "Assessment",
        edition: "2026",
        form: "A",
        language: "en",
        scoringVersion: "score-v1",
        normVersion: "norm-v1",
        reportVersion: "report-v1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentVersion.create).not.toHaveBeenCalled();
  });

  it("blocks a platform super admin from versioning an organization-owned definition", async () => {
    prisma.assessmentDefinition.findUnique.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      organizationId,
    });

    await expect(
      service.createDraftVersion(platformContext, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
        versionNumber: 1,
        title: "Assessment",
        edition: "2026",
        form: "A",
        language: "en",
        scoringVersion: "score-v1",
        normVersion: "norm-v1",
        reportVersion: "report-v1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentVersion.create).not.toHaveBeenCalled();
  });

  it("creates only DRAFT versions for an authorized organization admin", async () => {
    prisma.assessmentDefinition.findUnique.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      organizationId,
    });

    prisma.assessmentVersion.create.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      assessmentDefinitionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      versionNumber: 1,
      status: "DRAFT",
    });

    await service.createDraftVersion(organizationContext, "cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
      versionNumber: 1,
      title: " Career Assessment ",
      edition: " 2026 ",
      form: " A ",
      language: " en ",
      scoringVersion: " score-v1 ",
      normVersion: " norm-v1 ",
      reportVersion: " report-v1 ",
    });

    expect(prisma.assessmentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          title: "Career Assessment",
          edition: "2026",
          form: "A",
          language: "en",
          scoringVersion: "score-v1",
          normVersion: "norm-v1",
          reportVersion: "report-v1",
        }),
      }),
    );
  });

  it("returns not found when creating a version for a missing definition", async () => {
    prisma.assessmentDefinition.findUnique.mockResolvedValue(null);

    await expect(
      service.createDraftVersion(organizationContext, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", {
        versionNumber: 1,
        title: "Assessment",
        edition: "2026",
        form: "A",
        language: "en",
        scoringVersion: "score-v1",
        normVersion: "norm-v1",
        reportVersion: "report-v1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps duplicate assessment codes to a safe conflict error", async () => {
    prisma.assessmentDefinition.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      service.createDefinition(organizationContext, {
        code: "CAREER_TEST",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it("allows editing an owned DRAFT assessment version", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: "12121212-1212-4121-8121-121212121212",
      assessmentDefinitionId: "13131313-1313-4131-8131-131313131313",
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentVersion.update.mockResolvedValue({
      id: "12121212-1212-4121-8121-121212121212",
      status: AssessmentVersionStatus.DRAFT,
      title: "Updated Assessment",
    });

    await service.updateDraftVersion(
      organizationContext,
      "13131313-1313-4131-8131-131313131313",
      "12121212-1212-4121-8121-121212121212",
      {
        title: " Updated Assessment ",
        description: " Updated description ",
        instructions: " ",
      },
    );

    expect(prisma.assessmentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "12121212-1212-4121-8121-121212121212",
        },
        data: expect.objectContaining({
          title: "Updated Assessment",
          description: "Updated description",
          instructions: null,
        }),
      }),
    );
  });

  it("blocks editing a PUBLISHED assessment version", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: "14141414-1414-4141-8141-141414141414",
      assessmentDefinitionId: "15151515-1515-4151-8151-151515151515",
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.updateDraftVersion(
        organizationContext,
        "15151515-1515-4151-8151-151515151515",
        "14141414-1414-4141-8141-141414141414",
        {
          title: "Must not change",
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("blocks editing a RETIRED assessment version", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: "16161616-1616-4161-8161-161616161616",
      assessmentDefinitionId: "17171717-1717-4171-8171-171717171717",
      status: AssessmentVersionStatus.RETIRED,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.updateDraftVersion(
        organizationContext,
        "17171717-1717-4171-8171-171717171717",
        "16161616-1616-4161-8161-161616161616",
        {
          title: "Must not change",
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("blocks editing a DRAFT version owned by another organization", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: "18181818-1818-4181-8181-181818181818",
      assessmentDefinitionId: "19191919-1919-4191-8191-191919191919",
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId: "20202020-2020-4202-8202-202020202020",
      },
    });

    await expect(
      service.updateDraftVersion(
        organizationContext,
        "19191919-1919-4191-8191-191919191919",
        "18181818-1818-4181-8181-181818181818",
        {
          title: "Unauthorized edit",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("returns not found when the version does not belong to the requested definition", async () => {
    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: "21212121-2121-4212-8212-212121212121",
      assessmentDefinitionId: "22222222-2222-4222-8222-222222222222",
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.updateDraftVersion(
        organizationContext,
        "23232323-2323-4232-8232-232323232323",
        "21212121-2121-4212-8212-212121212121",
        {
          title: "Wrong definition",
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("creates a construct only inside an owned DRAFT version", async () => {
    const definitionId = "24242424-2424-4242-8242-242424242424";
    const versionId = "25252525-2525-4252-8252-252525252525";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentConstruct.create.mockResolvedValue({
      id: "26262626-2626-4262-8262-262626262626",
      assessmentVersionId: versionId,
      code: "APTITUDE",
      name: "Aptitude",
      description: null,
      orderIndex: 0,
    });

    await service.createConstruct(organizationContext, definitionId, versionId, {
      code: " APTITUDE ",
      name: " Aptitude ",
      orderIndex: 0,
    });

    expect(prisma.assessmentConstruct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assessmentVersionId: versionId,
          code: "APTITUDE",
          name: "Aptitude",
          orderIndex: 0,
        }),
      }),
    );
  });

  it("creates an assessment item inside an owned DRAFT version", async () => {
    const definitionId = "27272727-2727-4272-8272-272727272727";
    const versionId = "28282828-2828-4282-8282-282828282828";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentItem.create.mockResolvedValue({
      id: "29292929-2929-4292-8292-292929292929",
      assessmentVersionId: versionId,
      code: "Q1",
      type: AssessmentItemType.SINGLE_CHOICE,
      prompt: "Choose one",
      orderIndex: 0,
      required: true,
    });

    await service.createItem(organizationContext, definitionId, versionId, {
      code: " Q1 ",
      type: AssessmentItemType.SINGLE_CHOICE,
      prompt: " Choose one ",
      orderIndex: 0,
    });

    expect(prisma.assessmentItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assessmentVersionId: versionId,
          code: "Q1",
          type: AssessmentItemType.SINGLE_CHOICE,
          prompt: "Choose one",
          orderIndex: 0,
          required: true,
        }),
      }),
    );
  });

  it("creates an option only for an item belonging to the requested DRAFT version", async () => {
    const definitionId = "30303030-3030-4303-8303-303030303030";
    const versionId = "31313131-3131-4313-8313-313131313131";
    const itemId = "32323232-3232-4323-8323-323232323232";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentItem.findFirst.mockResolvedValue({
      id: itemId,
    });

    prisma.assessmentItemOption.create.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333334",
      assessmentItemId: itemId,
      code: "A",
      label: "Option A",
      orderIndex: 0,
    });

    await service.createItemOption(organizationContext, definitionId, versionId, itemId, {
      code: " A ",
      label: " Option A ",
      orderIndex: 0,
    });

    expect(prisma.assessmentItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: itemId,
        assessmentVersionId: versionId,
      },
      select: {
        id: true,
      },
    });

    expect(prisma.assessmentItemOption.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assessmentItemId: itemId,
          code: "A",
          label: "Option A",
          orderIndex: 0,
        }),
      }),
    );
  });

  it("returns DRAFT version content with constructs, items and options", async () => {
    const definitionId = "34343434-3434-4343-8343-343434343434";
    const versionId = "35353535-3535-4353-8353-353535353535";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentVersion.findUniqueOrThrow.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.DRAFT,
      constructs: [],
      items: [],
    });

    await service.getVersionContent(organizationContext, definitionId, versionId);

    expect(prisma.assessmentVersion.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: versionId,
        },
      }),
    );
  });

  it("blocks content modification when the assessment version is PUBLISHED", async () => {
    const definitionId = "36363636-3636-4363-8363-363636363636";
    const versionId = "37373737-3737-4373-8373-373737373737";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.createConstruct(organizationContext, definitionId, versionId, {
        code: "BLOCKED",
        name: "Blocked",
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentConstruct.create).not.toHaveBeenCalled();
  });

  it("blocks content modification when the assessment version is RETIRED", async () => {
    const definitionId = "38383838-3838-4383-8383-383838383838";
    const versionId = "39393939-3939-4393-8393-393939393939";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.RETIRED,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.createItem(organizationContext, definitionId, versionId, {
        code: "Q1",
        type: AssessmentItemType.TEXT,
        prompt: "Blocked",
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentItem.create).not.toHaveBeenCalled();
  });

  it("blocks DRAFT content modification across organization boundaries", async () => {
    const definitionId = "40404040-4040-4404-8404-404040404040";
    const versionId = "41414141-4141-4414-8414-414141414141";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId: "42424242-4242-4424-8424-424242424242",
      },
    });

    await expect(
      service.createConstruct(organizationContext, definitionId, versionId, {
        code: "PRIVATE",
        name: "Private",
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentConstruct.create).not.toHaveBeenCalled();
  });

  it("rejects an option when the item is not part of the requested version", async () => {
    const definitionId = "43434343-4343-4434-8434-434343434343";
    const versionId = "44444444-4444-4444-8444-444444444445";
    const itemId = "45454545-4545-4454-8454-454545454545";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentItem.findFirst.mockResolvedValue(null);

    await expect(
      service.createItemOption(organizationContext, definitionId, versionId, itemId, {
        code: "A",
        label: "Option A",
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assessmentItemOption.create).not.toHaveBeenCalled();
  });

  it("maps duplicate construct code or order to a safe conflict", async () => {
    const definitionId = "46464646-4646-4464-8464-464646464646";
    const versionId = "47474747-4747-4474-8474-474747474747";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentConstruct.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      service.createConstruct(organizationContext, definitionId, versionId, {
        code: "APTITUDE",
        name: "Aptitude",
        orderIndex: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
