import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AssessmentAttemptStatus, MembershipRole, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentResultsService } from "./assessment-results.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";

const counsellorContext: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444444",
  organizationId,
  membershipId: "55555555-5555-4555-8555-555555555555",
  role: MembershipRole.COUNSELLOR,
  sessionId: "66666666-6666-4666-8666-666666666666",
};

const platformContext: AuthContext = {
  userId: "77777777-7777-4777-8777-777777777777",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "88888888-8888-4888-8888-888888888888",
};

function createPrisma() {
  return {
    organization: {
      findFirst: vi.fn(),
    },
    assessmentAttempt: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
}

describe("AssessmentResultsService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentResultsService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentResultsService(prisma as unknown as PrismaClient);
  });

  it("lists only submitted results in the counsellor organization", async () => {
    prisma.assessmentAttempt.findMany.mockResolvedValue([]);

    await service.listResults(counsellorContext);

    expect(prisma.assessmentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: AssessmentAttemptStatus.SUBMITTED,
          assignment: {
            organizationId,
          },
        },
      }),
    );
  });

  it("rejects cross-tenant result access", async () => {
    await expect(
      service.listResults(counsellorContext, otherOrganizationId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires explicit organization selection for platform administrators", async () => {
    await expect(service.listResults(platformContext)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns not found rather than leaking a result outside scope", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(null);

    await expect(service.getResult(counsellorContext, attemptId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("serializes raw construct scores without exposing response keys", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({
      id: attemptId,
      attemptNumber: 1,
      startedAt: new Date("2026-08-11T08:00:00Z"),
      lastActivityAt: new Date("2026-08-11T08:30:00Z"),
      submittedAt: new Date("2026-08-11T08:30:00Z"),
      assignment: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        organizationId,
        assignedAt: new Date("2026-08-10T08:00:00Z"),
        user: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          email: "candidate@example.com",
          firstName: "Test",
          lastName: "Candidate",
        },
        assessmentVersion: {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          versionNumber: 1,
          title: "Assessment",
          edition: "2026",
          form: "A",
          language: "en",
          scoringVersion: "score-v1",
          normVersion: "norm-v1",
          reportVersion: "report-v1",
          assessmentDefinition: {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            code: "TEST",
          },
        },
      },
      scoringRuns: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          scoringVersion: "score-v1",
          algorithmVersion: "explicit-option-key-v1",
          inputHash: "a".repeat(64),
          calculatedAt: new Date("2026-08-11T08:31:00Z"),
          constructScores: [
            {
              assessmentConstructId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              rawScore: {
                toString: () => "12.50000000",
              },
              answeredItemCount: 10,
              contributionCount: 10,
              assessmentConstruct: {
                code: "C1",
                name: "Construct One",
                orderIndex: 1,
              },
            },
          ],
          reportDataSnapshots: [],
        },
      ],
    });

    const result = await service.getResult(counsellorContext, attemptId);

    expect(result.scoring?.constructs[0]?.rawScore).toBe("12.50000000");
    expect(JSON.stringify(result)).not.toContain("optionScores");
    expect(JSON.stringify(result)).not.toContain("responses");
  });
});
