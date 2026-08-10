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
  const prisma = {
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
      findFirst: vi.fn(),
    },
    assessmentItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    assessmentItemOption: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    assessmentItemConstruct: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    assessmentOptionScore: {
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

  it("creates an item-to-construct link inside the same DRAFT version", async () => {
    const definitionId = "48484848-4848-4484-8484-484848484848";
    const versionId = "49494949-4949-4494-8494-494949494949";
    const itemId = "50505050-5050-4505-8505-505050505050";
    const constructId = "51515151-5151-4515-8515-515151515151";

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

    prisma.assessmentConstruct.findFirst.mockResolvedValue({
      id: constructId,
    });

    prisma.assessmentItemConstruct.create.mockResolvedValue({
      assessmentItemId: itemId,
      assessmentConstructId: constructId,
      weight: new Prisma.Decimal("1.5"),
      reverseScored: false,
    });

    await service.createItemConstructLink(organizationContext, definitionId, versionId, itemId, {
      constructId,
      weight: 1.5,
      reverseScored: false,
    });

    expect(prisma.assessmentConstruct.findFirst).toHaveBeenCalledWith({
      where: {
        id: constructId,
        assessmentVersionId: versionId,
      },
      select: {
        id: true,
      },
    });

    expect(prisma.assessmentItemConstruct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          assessmentItemId: itemId,
          assessmentConstructId: constructId,
          weight: 1.5,
          reverseScored: false,
        },
      }),
    );
  });

  it("rejects an item-to-construct link when the construct is outside the version", async () => {
    const definitionId = "52525252-5252-4525-8525-525252525252";
    const versionId = "53535353-5353-4535-8535-535353535353";
    const itemId = "54545454-5454-4545-8545-545454545454";
    const constructId = "55555555-5555-4555-8555-555555555556";

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

    prisma.assessmentConstruct.findFirst.mockResolvedValue(null);

    await expect(
      service.createItemConstructLink(organizationContext, definitionId, versionId, itemId, {
        constructId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assessmentItemConstruct.create).not.toHaveBeenCalled();
  });

  it("creates an explicit option score only when the construct link exists", async () => {
    const definitionId = "56565656-5656-4565-8565-565656565656";
    const versionId = "57575757-5757-4575-8575-575757575757";
    const itemId = "58585858-5858-4585-8585-585858585858";
    const optionId = "59595959-5959-4595-8595-595959595959";
    const constructId = "60606060-6060-4606-8606-606060606060";

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

    prisma.assessmentItemOption.findFirst.mockResolvedValue({
      id: optionId,
    });

    prisma.assessmentItemConstruct.findUnique.mockResolvedValue({
      assessmentItemId: itemId,
      assessmentConstructId: constructId,
    });

    prisma.assessmentOptionScore.create.mockResolvedValue({
      assessmentItemOptionId: optionId,
      assessmentConstructId: constructId,
      score: new Prisma.Decimal("2.5"),
    });

    await service.createOptionScore(
      organizationContext,
      definitionId,
      versionId,
      itemId,
      optionId,
      {
        constructId,
        score: 2.5,
      },
    );

    expect(prisma.assessmentOptionScore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          assessmentItemOptionId: optionId,
          assessmentConstructId: constructId,
          score: 2.5,
        },
      }),
    );
  });

  it("rejects an explicit option score when the item-to-construct link is missing", async () => {
    const definitionId = "61616161-6161-4616-8616-616161616161";
    const versionId = "62626262-6262-4626-8626-626262626262";
    const itemId = "63636363-6363-4636-8636-636363636363";
    const optionId = "64646464-6464-4646-8646-646464646464";
    const constructId = "65656565-6565-4656-8656-656565656565";

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

    prisma.assessmentItemOption.findFirst.mockResolvedValue({
      id: optionId,
    });

    prisma.assessmentItemConstruct.findUnique.mockResolvedValue(null);

    await expect(
      service.createOptionScore(organizationContext, definitionId, versionId, itemId, optionId, {
        constructId,
        score: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentOptionScore.create).not.toHaveBeenCalled();
  });

  it("rejects an option score when the option does not belong to the requested item", async () => {
    const definitionId = "66666666-6666-4666-8666-666666666667";
    const versionId = "67676767-6767-4676-8676-676767676767";
    const itemId = "68686868-6868-4686-8686-686868686868";
    const optionId = "69696969-6969-4696-8696-696969696969";
    const constructId = "70707070-7070-4707-8707-707070707070";

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

    prisma.assessmentItemOption.findFirst.mockResolvedValue(null);

    prisma.assessmentItemConstruct.findUnique.mockResolvedValue({
      assessmentItemId: itemId,
      assessmentConstructId: constructId,
    });

    await expect(
      service.createOptionScore(organizationContext, definitionId, versionId, itemId, optionId, {
        constructId,
        score: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.assessmentOptionScore.create).not.toHaveBeenCalled();
  });

  it("blocks scoring configuration changes on a PUBLISHED version", async () => {
    const definitionId = "71717171-7171-4717-8717-717171717171";
    const versionId = "72727272-7272-4727-8727-727272727272";
    const itemId = "73737373-7373-4737-8737-737373737373";
    const constructId = "74747474-7474-4747-8747-747474747474";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.createItemConstructLink(organizationContext, definitionId, versionId, itemId, {
        constructId,
        weight: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentItemConstruct.create).not.toHaveBeenCalled();
  });

  it("maps duplicate item-to-construct links to a safe conflict", async () => {
    const definitionId = "75757575-7575-4757-8757-757575757575";
    const versionId = "76767676-7676-4767-8767-767676767676";
    const itemId = "77777777-7777-4777-8777-777777777778";
    const constructId = "78787878-7878-4787-8787-787878787878";

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

    prisma.assessmentConstruct.findFirst.mockResolvedValue({
      id: constructId,
    });

    prisma.assessmentItemConstruct.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      service.createItemConstructLink(organizationContext, definitionId, versionId, itemId, {
        constructId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps duplicate option scores to a safe conflict", async () => {
    const definitionId = "79797979-7979-4797-8797-797979797979";
    const versionId = "80808080-8080-4808-8808-808080808080";
    const itemId = "81818181-8181-4818-8818-818181818181";
    const optionId = "82828282-8282-4828-8828-828282828282";
    const constructId = "83838383-8383-4838-8838-838383838383";

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

    prisma.assessmentItemOption.findFirst.mockResolvedValue({
      id: optionId,
    });

    prisma.assessmentItemConstruct.findUnique.mockResolvedValue({
      assessmentItemId: itemId,
      assessmentConstructId: constructId,
    });

    prisma.assessmentOptionScore.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      service.createOptionScore(organizationContext, definitionId, versionId, itemId, optionId, {
        constructId,
        score: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("reports a structurally complete DRAFT version as ready for publication", async () => {
    const definitionId = "84848484-8484-4848-8848-848484848484";
    const versionId = "85858585-8585-4858-8858-858585858585";
    const itemId = "86868686-8686-4868-8868-868686868686";
    const optionId = "87878787-8787-4878-8878-878787878787";
    const constructId = "88888888-8888-4888-8888-888888888888";

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
      assessmentDefinition: {
        status: "ACTIVE",
      },
      items: [
        {
          id: itemId,
          code: "Q1",
          type: AssessmentItemType.SINGLE_CHOICE,
          constructLinks: [
            {
              assessmentConstructId: constructId,
            },
          ],
          options: [
            {
              id: optionId,
              code: "A",
              scores: [
                {
                  assessmentConstructId: constructId,
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await service.getPublicationReadiness(
      organizationContext,
      definitionId,
      versionId,
    );

    expect(result).toEqual({
      versionId,
      ready: true,
      issues: [],
    });
  });

  it("blocks publication when the DRAFT version has no items", async () => {
    const definitionId = "89898989-8989-4898-8898-898989898989";
    const versionId = "90909090-9090-4909-8909-909090909090";

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
      assessmentDefinition: {
        status: "ACTIVE",
      },
      items: [],
    });

    await expect(
      service.publishVersion(organizationContext, definitionId, versionId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("blocks publication for an archived assessment definition", async () => {
    const definitionId = "91919191-9191-4919-8919-919191919191";
    const versionId = "92929292-9292-4929-8929-929292929292";

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
      assessmentDefinition: {
        status: "ARCHIVED",
      },
      items: [
        {
          id: "93939393-9393-4939-8939-939393939393",
          code: "Q1",
          type: AssessmentItemType.TEXT,
          constructLinks: [],
          options: [],
        },
      ],
    });

    const result = await service.getPublicationReadiness(
      organizationContext,
      definitionId,
      versionId,
    );

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ASSESSMENT_DEFINITION_NOT_ACTIVE",
        }),
      ]),
    );
  });

  it("blocks readiness when a scored item uses an unsupported response type", async () => {
    const definitionId = "94949494-9494-4949-8949-949494949494";
    const versionId = "95959595-9595-4959-8959-959595959595";
    const constructId = "96969696-9696-4969-8969-969696969696";

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
      assessmentDefinition: {
        status: "ACTIVE",
      },
      items: [
        {
          id: "97979797-9797-4979-8979-979797979797",
          code: "Q1",
          type: AssessmentItemType.TEXT,
          constructLinks: [
            {
              assessmentConstructId: constructId,
            },
          ],
          options: [],
        },
      ],
    });

    const result = await service.getPublicationReadiness(
      organizationContext,
      definitionId,
      versionId,
    );

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ASSESSMENT_SCORING_CONFIGURATION_UNSUPPORTED",
        }),
      ]),
    );
  });

  it("blocks readiness when an option is missing an explicit linked-construct score", async () => {
    const definitionId = "98989898-9898-4989-8989-989898989898";
    const versionId = "99999999-9999-4999-8999-999999999999";
    const constructId = "10101010-1010-4010-8010-101010101010";

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
      assessmentDefinition: {
        status: "ACTIVE",
      },
      items: [
        {
          id: "11101010-1010-4010-8010-101010101010",
          code: "Q1",
          type: AssessmentItemType.SINGLE_CHOICE,
          constructLinks: [
            {
              assessmentConstructId: constructId,
            },
          ],
          options: [
            {
              id: "12101010-1010-4010-8010-101010101010",
              code: "A",
              scores: [],
            },
          ],
        },
      ],
    });

    const result = await service.getPublicationReadiness(
      organizationContext,
      definitionId,
      versionId,
    );

    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ASSESSMENT_OPTION_SCORE_INCOMPLETE",
          constructId,
        }),
      ]),
    );
  });

  it("publishes a ready DRAFT version with publication provenance", async () => {
    const definitionId = "13101010-1010-4010-8010-101010101010";
    const versionId = "14101010-1010-4010-8010-101010101010";

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
      assessmentDefinition: {
        status: "ACTIVE",
      },
      items: [
        {
          id: "15101010-1010-4010-8010-101010101010",
          code: "Q1",
          type: AssessmentItemType.TEXT,
          constructLinks: [],
          options: [],
        },
      ],
    });

    prisma.assessmentVersion.update.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.PUBLISHED,
    });

    await service.publishVersion(organizationContext, definitionId, versionId);

    expect(prisma.assessmentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: versionId,
        },
        data: expect.objectContaining({
          status: AssessmentVersionStatus.PUBLISHED,
          publishedByUserId: organizationContext.userId,
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("retires a PUBLISHED version while preserving publication provenance", async () => {
    const definitionId = "16101010-1010-4010-8010-101010101010";
    const versionId = "17101010-1010-4010-8010-101010101010";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        organizationId,
      },
    });

    prisma.assessmentVersion.update.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.RETIRED,
    });

    await service.retireVersion(organizationContext, definitionId, versionId);

    expect(prisma.assessmentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: versionId,
        },
        data: {
          status: AssessmentVersionStatus.RETIRED,
          retiredAt: expect.any(Date),
        },
      }),
    );
  });

  it("rejects retirement of a DRAFT version", async () => {
    const definitionId = "18101010-1010-4010-8010-101010101010";
    const versionId = "19101010-1010-4010-8010-101010101010";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.retireVersion(organizationContext, definitionId, versionId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("rejects retirement of an already RETIRED version", async () => {
    const definitionId = "20101010-1010-4010-8010-101010101010";
    const versionId = "21101010-1010-4010-8010-101010101010";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.RETIRED,
      assessmentDefinition: {
        organizationId,
      },
    });

    await expect(
      service.retireVersion(organizationContext, definitionId, versionId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("blocks cross-organization publication", async () => {
    const definitionId = "22101010-1010-4010-8010-101010101010";
    const versionId = "23101010-1010-4010-8010-101010101010";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId: "24101010-1010-4010-8010-101010101010",
      },
    });

    await expect(
      service.publishVersion(organizationContext, definitionId, versionId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("blocks cross-organization retirement", async () => {
    const definitionId = "25101010-1010-4010-8010-101010101010";
    const versionId = "26101010-1010-4010-8010-101010101010";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        organizationId: "27101010-1010-4010-8010-101010101010",
      },
    });

    await expect(
      service.retireVersion(organizationContext, definitionId, versionId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.assessmentVersion.update).not.toHaveBeenCalled();
  });

  it("returns construct links and explicit option scores in draft content", async () => {
    const definitionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const versionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    prisma.assessmentVersion.findUnique.mockResolvedValue({
      id: versionId,
      assessmentDefinitionId: definitionId,
      status: AssessmentVersionStatus.DRAFT,
      assessmentDefinition: {
        organizationId: null,
      },
    });

    prisma.assessmentVersion.findUniqueOrThrow.mockResolvedValue({
      id: versionId,
      versionNumber: 1,
      status: AssessmentVersionStatus.DRAFT,
      constructs: [],
      items: [],
    });

    await service.getVersionContent(platformContext, definitionId, versionId);

    expect(prisma.assessmentVersion.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          items: expect.objectContaining({
            select: expect.objectContaining({
              constructLinks: expect.objectContaining({
                select: expect.objectContaining({
                  assessmentConstructId: true,
                  weight: true,
                  reverseScored: true,
                }),
              }),
              options: expect.objectContaining({
                select: expect.objectContaining({
                  scores: expect.objectContaining({
                    select: expect.objectContaining({
                      assessmentConstructId: true,
                      score: true,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });
});
