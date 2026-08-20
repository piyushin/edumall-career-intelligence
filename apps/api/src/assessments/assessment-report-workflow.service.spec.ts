import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import type { AssessmentInterpretationService } from "./assessment-interpretation.service";
import type { AssessmentNormService } from "./assessment-norm.service";
import type { AssessmentReportDataService } from "./assessment-report-data.service";
import { AssessmentReportWorkflowService } from "./assessment-report-workflow.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const scoringRunId = "44444444-4444-4444-8444-444444444444";
const normGroupId = "55555555-5555-4555-8555-555555555555";
const interpretationSetId = "66666666-6666-4666-8666-666666666666";

const counsellorContext: AuthContext = {
  userId: "77777777-7777-4777-8777-777777777777",
  organizationId,
  membershipId: "88888888-8888-4888-8888-888888888888",
  role: MembershipRole.COUNSELLOR,
  sessionId: "99999999-9999-4999-8999-999999999999",
};

const superAdminContext: AuthContext = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

function createPrisma() {
  return {
    organization: {
      findFirst: vi.fn(),
    },
    assessmentAttempt: {
      findFirst: vi.fn(),
    },
    assessmentNormSet: {
      findMany: vi.fn(),
    },
    assessmentInterpretationSet: {
      findMany: vi.fn(),
    },
  };
}

function submittedAttempt(withScoring = true) {
  return {
    id: attemptId,
    assignment: {
      assessmentVersion: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        normVersion: "norm-v1",
      },
    },
    reportReleases: [],
    scoringRuns: withScoring
      ? [
          {
            id: scoringRunId,
            reportDataSnapshots: [],
          },
        ]
      : [],
  };
}

describe("AssessmentReportWorkflowService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let norms: {
    applyPublishedNormGroup: ReturnType<typeof vi.fn>;
  };
  let interpretations: {
    applyPublishedInterpretationSet: ReturnType<typeof vi.fn>;
  };
  let reportData: {
    createSnapshot: ReturnType<typeof vi.fn>;
  };
  let service: AssessmentReportWorkflowService;

  beforeEach(() => {
    prisma = createPrisma();
    norms = {
      applyPublishedNormGroup: vi.fn(),
    };
    interpretations = {
      applyPublishedInterpretationSet: vi.fn(),
    };
    reportData = {
      createSnapshot: vi.fn(),
    };

    service = new AssessmentReportWorkflowService(
      prisma as unknown as PrismaClient,
      norms as unknown as AssessmentNormService,
      interpretations as unknown as AssessmentInterpretationService,
      reportData as unknown as AssessmentReportDataService,
    );
  });

  it("rejects cross-tenant report workflow access", async () => {
    await expect(
      service.getReadiness(counsellorContext, attemptId, otherOrganizationId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires explicit organization for super administrators", async () => {
    await expect(service.getReadiness(superAdminContext, attemptId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns not found without leaking another tenant result", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(null);

    await expect(service.getReadiness(counsellorContext, attemptId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("reports readiness only from published scientific configuration", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(submittedAttempt());

    prisma.assessmentNormSet.findMany.mockResolvedValue([
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        name: "Approved Norms",
        normVersion: "norm-v1",
        sourceReference: "approved-source",
        groups: [
          {
            id: normGroupId,
            code: "DEFAULT",
            name: "Approved Group",
            description: null,
            sampleSize: 500,
          },
        ],
      },
    ]);

    prisma.assessmentInterpretationSet.findMany.mockResolvedValue([
      {
        id: interpretationSetId,
        version: "interpret-v1",
        name: "Approved Interpretation",
        description: null,
        sourceReference: "approved-source",
      },
    ]);

    const result = await service.getReadiness(counsellorContext, attemptId);

    expect(result.status).toBe("READY");
    expect(result.canGenerate).toBe(true);
    expect(result.publishedNormGroups).toHaveLength(1);
    expect(result.publishedInterpretationSets).toHaveLength(1);
  });

  it("rejects report generation when scoring is unavailable", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(submittedAttempt(false));

    await expect(
      service.generate(counsellorContext, attemptId, normGroupId, interpretationSetId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("runs norm, interpretation, and snapshot stages in governed order", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(submittedAttempt());

    norms.applyPublishedNormGroup.mockResolvedValue([]);
    interpretations.applyPublishedInterpretationSet.mockResolvedValue([]);
    reportData.createSnapshot.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      scoringRunId,
      assessmentVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      interpretationSetId,
      reportVersion: "report-v1",
      inputHash: "a".repeat(64),
      payload: {
        schemaVersion: "assessment-report-data-v1",
      },
      generatedAt: new Date(),
    });

    await service.generate(counsellorContext, attemptId, normGroupId, interpretationSetId);

    expect(norms.applyPublishedNormGroup).toHaveBeenCalledWith(scoringRunId, normGroupId);

    expect(interpretations.applyPublishedInterpretationSet).toHaveBeenCalledWith(
      scoringRunId,
      normGroupId,
      interpretationSetId,
    );

    expect(reportData.createSnapshot).toHaveBeenCalledWith(
      scoringRunId,
      normGroupId,
      interpretationSetId,
    );

    expect(norms.applyPublishedNormGroup.mock.invocationCallOrder[0]).toBeLessThan(
      interpretations.applyPublishedInterpretationSet.mock.invocationCallOrder[0]!,
    );

    expect(
      interpretations.applyPublishedInterpretationSet.mock.invocationCallOrder[0],
    ).toBeLessThan(reportData.createSnapshot.mock.invocationCallOrder[0]!);
  });
});
