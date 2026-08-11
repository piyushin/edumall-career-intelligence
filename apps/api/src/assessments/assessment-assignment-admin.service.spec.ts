import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentAssignmentStatus,
  AssessmentVersionStatus,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentAssignmentAdminService } from "./assessment-assignment-admin.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const versionId = "33333333-3333-4333-8333-333333333333";
const candidateId = "44444444-4444-4444-8444-444444444444";
const assignmentId = "55555555-5555-4555-8555-555555555555";

const organizationContext: AuthContext = {
  userId: "66666666-6666-4666-8666-666666666666",
  organizationId,
  membershipId: "77777777-7777-4777-8777-777777777777",
  role: MembershipRole.ORGANIZATION_ADMIN,
  sessionId: "88888888-8888-4888-8888-888888888888",
};

const platformContext: AuthContext = {
  userId: "99999999-9999-4999-8999-999999999999",
  organizationId: null,
  membershipId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

function createPrisma() {
  const prisma = {
    organization: {
      findFirst: vi.fn(),
    },
    organizationMembership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    assessmentVersion: {
      findFirst: vi.fn(),
    },
    assessmentAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) =>
    callback(prisma),
  );

  return prisma;
}

describe("AssessmentAssignmentAdminService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentAssignmentAdminService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentAssignmentAdminService(prisma as unknown as PrismaClient);
  });

  it("lists assignments only inside the organization-admin tenant", async () => {
    prisma.assessmentAssignment.findMany.mockResolvedValue([]);

    await service.listAssignments(organizationContext);

    expect(prisma.assessmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
        },
      }),
    );
  });

  it("rejects organization-admin attempts to cross tenant boundaries", async () => {
    await expect(
      service.listAssignments(organizationContext, otherOrganizationId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires a super admin to explicitly select an organization", async () => {
    await expect(service.listAssignments(platformContext)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns only active student/employee candidates", async () => {
    prisma.organizationMembership.findMany.mockResolvedValue([]);

    await service.listEligibleCandidates(organizationContext);

    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          role: {
            in: [MembershipRole.STUDENT, MembershipRole.EMPLOYEE],
          },
        }),
      }),
    );
  });

  it("rejects assignment of a non-published or inaccessible assessment version", async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue(null);

    await expect(
      service.createAssignment(organizationContext, {
        assessmentVersionId: versionId,
        userId: candidateId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects an invalid availability window", async () => {
    await expect(
      service.createAssignment(organizationContext, {
        assessmentVersionId: versionId,
        userId: candidateId,
        availableFrom: "2026-08-11T10:00:00.000Z",
        expiresAt: "2026-08-10T10:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects candidates without an active student/employee membership", async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        organizationId,
      },
    });
    prisma.organizationMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.createAssignment(organizationContext, {
        assessmentVersionId: versionId,
        userId: candidateId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a duplicate live assignment", async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        organizationId,
      },
    });
    prisma.organizationMembership.findFirst.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      role: MembershipRole.STUDENT,
      userId: candidateId,
    });
    prisma.assessmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
    });

    await expect(
      service.createAssignment(organizationContext, {
        assessmentVersionId: versionId,
        userId: candidateId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates a tenant-bound assignment with provenance", async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        organizationId,
      },
    });
    prisma.organizationMembership.findFirst.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      role: MembershipRole.STUDENT,
      userId: candidateId,
    });
    prisma.assessmentAssignment.findFirst.mockResolvedValue(null);
    prisma.assessmentAssignment.create.mockResolvedValue({
      id: assignmentId,
    });

    await service.createAssignment(organizationContext, {
      assessmentVersionId: versionId,
      userId: candidateId,
      maxAttempts: 2,
    });

    expect(prisma.assessmentAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          assessmentVersionId: versionId,
          userId: candidateId,
          assignedByUserId: organizationContext.userId,
          maxAttempts: 2,
        }),
      }),
    );
  });

  it("creates assignments inside a serializable transaction", async () => {
    prisma.assessmentVersion.findFirst.mockResolvedValue({
      id: versionId,
      status: AssessmentVersionStatus.PUBLISHED,
      assessmentDefinition: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        organizationId,
      },
    });
    prisma.organizationMembership.findFirst.mockResolvedValue({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      role: MembershipRole.STUDENT,
      userId: candidateId,
    });
    prisma.assessmentAssignment.findFirst.mockResolvedValue(null);
    prisma.assessmentAssignment.create.mockResolvedValue({
      id: assignmentId,
    });

    await service.createAssignment(organizationContext, {
      assessmentVersionId: versionId,
      userId: candidateId,
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: "Serializable",
      }),
    );
  });

  it("cancels an active assignment without deleting history", async () => {
    prisma.assessmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      organizationId,
      status: AssessmentAssignmentStatus.ACTIVE,
      cancelledAt: null,
    });
    prisma.assessmentAssignment.update.mockResolvedValue({
      id: assignmentId,
      organizationId,
      status: AssessmentAssignmentStatus.CANCELLED,
      cancelledAt: new Date(),
    });

    await service.cancelAssignment(organizationContext, assignmentId);

    expect(prisma.assessmentAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: assignmentId,
        },
        data: expect.objectContaining({
          status: AssessmentAssignmentStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });

  it("makes cancellation idempotent once already cancelled", async () => {
    const cancelledAt = new Date();

    prisma.assessmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      organizationId,
      status: AssessmentAssignmentStatus.CANCELLED,
      cancelledAt,
    });

    await expect(service.cancelAssignment(organizationContext, assignmentId)).resolves.toEqual({
      id: assignmentId,
      organizationId,
      status: AssessmentAssignmentStatus.CANCELLED,
      cancelledAt,
    });

    expect(prisma.assessmentAssignment.update).not.toHaveBeenCalled();
  });
});
