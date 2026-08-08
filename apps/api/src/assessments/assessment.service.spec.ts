import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import {
  AssessmentAssignmentStatus,
  AssessmentAttemptStatus,
  AssessmentItemType,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import type { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const assignmentId = "33333333-3333-4333-8333-333333333333";
const attemptId = "44444444-4444-4444-8444-444444444444";
const itemId = "55555555-5555-4555-8555-555555555555";
const optionId = "66666666-6666-4666-8666-666666666666";

const context: AuthContext = {
  userId,
  organizationId,
  membershipId: "77777777-7777-4777-8777-777777777777",
  role: MembershipRole.STUDENT,
  sessionId: "88888888-8888-4888-8888-888888888888",
};

function createPrisma() {
  const prisma = {
    assessmentAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    assessmentAttempt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assessmentItem: {
      findFirst: vi.fn(),
    },
    assessmentResponse: {
      upsert: vi.fn(),
    },
    assessmentResponseOption: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => unknown) =>
    callback(prisma),
  );

  return prisma;
}

describe("AssessmentService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrisma();
    service = new AssessmentService(
      prisma as unknown as PrismaClient,
      {
        scoreSubmittedAttempt: vi.fn().mockResolvedValue({}),
      } as unknown as AssessmentScoringService,
    );
  });

  it("requires organization scope", async () => {
    await expect(
      service.listAssignments({
        ...context,
        organizationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lists only assignments owned by the authenticated candidate and organization", async () => {
    prisma.assessmentAssignment.findMany.mockResolvedValue([]);

    await service.listAssignments(context);

    expect(prisma.assessmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId,
          userId,
        },
      }),
    );
  });

  it("resumes an existing in-progress attempt", async () => {
    prisma.assessmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      status: AssessmentAssignmentStatus.ACTIVE,
      maxAttempts: 2,
      availableFrom: null,
      expiresAt: null,
    });

    prisma.assessmentAttempt.findFirst.mockResolvedValueOnce({
      id: attemptId,
      assignmentId,
      attemptNumber: 1,
      status: AssessmentAttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      submittedAt: null,
    });

    const result = await service.startOrResumeAttempt(context, assignmentId);

    expect(result.id).toBe(attemptId);
    expect(prisma.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects attempts beyond the assignment limit", async () => {
    prisma.assessmentAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      status: AssessmentAssignmentStatus.ACTIVE,
      maxAttempts: 1,
      availableFrom: null,
      expiresAt: null,
    });

    prisma.assessmentAttempt.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      attemptNumber: 1,
    });

    await expect(service.startOrResumeAttempt(context, assignmentId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("saves a valid single-choice response without exposing scoring data", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({
      id: attemptId,
      status: AssessmentAttemptStatus.IN_PROGRESS,
      assignment: {
        assessmentVersionId: "99999999-9999-4999-8999-999999999999",
      },
    });

    prisma.assessmentItem.findFirst.mockResolvedValue({
      id: itemId,
      type: AssessmentItemType.SINGLE_CHOICE,
      options: [{ id: optionId }],
    });

    prisma.assessmentResponse.upsert.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    prisma.assessmentResponseOption.deleteMany.mockResolvedValue({
      count: 0,
    });

    prisma.assessmentResponseOption.createMany.mockResolvedValue({
      count: 1,
    });

    prisma.assessmentAttempt.update.mockResolvedValue({});

    const result = await service.saveResponse(context, attemptId, itemId, {
      optionIds: [optionId],
    });

    expect(result.status).toBe("saved");
    expect(prisma.assessmentResponseOption.createMany).toHaveBeenCalledWith({
      data: [
        {
          optionId,
          responseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      ],
    });
  });

  it("rejects response shapes that do not match the item type", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({
      id: attemptId,
      status: AssessmentAttemptStatus.IN_PROGRESS,
      assignment: {
        assessmentVersionId: "99999999-9999-4999-8999-999999999999",
      },
    });

    prisma.assessmentItem.findFirst.mockResolvedValue({
      id: itemId,
      type: AssessmentItemType.BOOLEAN,
      options: [],
    });

    await expect(
      service.saveResponse(context, attemptId, itemId, { textValue: "true" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects submission when a required item is unanswered", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({
      id: attemptId,
      status: AssessmentAttemptStatus.IN_PROGRESS,
      submittedAt: null,
      assignment: {
        assessmentVersion: {
          items: [
            {
              id: itemId,
              type: AssessmentItemType.BOOLEAN,
            },
          ],
        },
      },
      responses: [],
    });

    await expect(service.submitAttempt(context, attemptId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("submits a complete attempt", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({
      id: attemptId,
      status: AssessmentAttemptStatus.IN_PROGRESS,
      submittedAt: null,
      assignment: {
        assessmentVersion: {
          items: [
            {
              id: itemId,
              type: AssessmentItemType.BOOLEAN,
            },
          ],
        },
      },
      responses: [
        {
          itemId,
          textValue: null,
          numericValue: null,
          booleanValue: false,
          selections: [],
        },
      ],
    });

    prisma.assessmentAttempt.update.mockResolvedValue({});

    const result = await service.submitAttempt(context, attemptId);

    expect(result.status).toBe("submitted");
    expect(prisma.assessmentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: attemptId,
        },
        data: expect.objectContaining({
          status: AssessmentAttemptStatus.SUBMITTED,
        }),
      }),
    );
  });
});
