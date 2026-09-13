import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentReportReleaseStatus, MembershipRole, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { AssessmentReportReviewService } from "./assessment-report-review.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const releaseId = "44444444-4444-4444-8444-444444444444";
const counsellorUserId = "55555555-5555-4555-8555-555555555555";

const counsellorContext: AuthContext = {
  userId: counsellorUserId,
  organizationId,
  membershipId: "66666666-6666-4666-8666-666666666666",
  role: MembershipRole.COUNSELLOR,
  sessionId: "77777777-7777-4777-8777-777777777777",
};

const platformContext: AuthContext = {
  userId: "88888888-8888-4888-8888-888888888888",
  organizationId: null,
  membershipId: "99999999-9999-4999-8999-999999999999",
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function createPrisma() {
  return {
    organization: {
      findFirst: vi.fn(),
    },
    assessmentReportRelease: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    assessmentCounsellorNote: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe("AssessmentReportReviewService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AssessmentReportReviewService;

  beforeEach(() => {
    prisma = createPrisma();
    service = new AssessmentReportReviewService(prisma as unknown as PrismaClient);
  });

  describe("listReleases", () => {
    it("scopes a counsellor to their own organization", async () => {
      prisma.assessmentReportRelease.findMany.mockResolvedValue([]);

      await service.listReleases(counsellorContext);

      expect(prisma.assessmentReportRelease.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
        }),
      );
    });

    it("rejects a counsellor requesting another organization", async () => {
      await expect(
        service.listReleases(counsellorContext, otherOrganizationId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("requires an organization id for a platform super admin", async () => {
      await expect(service.listReleases(platformContext)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("filters by status when provided", async () => {
      prisma.assessmentReportRelease.findMany.mockResolvedValue([]);

      await service.listReleases(
        counsellorContext,
        undefined,
        AssessmentReportReleaseStatus.PENDING_REVIEW,
      );

      expect(prisma.assessmentReportRelease.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, status: AssessmentReportReleaseStatus.PENDING_REVIEW },
        }),
      );
    });
  });

  describe("release", () => {
    it("releases a pending review and stamps the reviewer", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        organizationId,
      });
      prisma.assessmentReportRelease.update.mockResolvedValue({});

      await service.release(counsellorContext, attemptId);

      expect(prisma.assessmentReportRelease.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { attemptId, organizationId },
        }),
      );

      expect(prisma.assessmentReportRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: releaseId },
          data: expect.objectContaining({
            status: AssessmentReportReleaseStatus.RELEASED,
            reviewedByUserId: counsellorUserId,
          }),
        }),
      );
    });

    it("rejects releasing a report that is not pending review", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.RELEASED,
        organizationId,
      });

      await expect(service.release(counsellorContext, attemptId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(prisma.assessmentReportRelease.update).not.toHaveBeenCalled();
    });

    it("does not find a report release belonging to another organization", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue(null);

      await expect(service.release(counsellorContext, attemptId)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(prisma.assessmentReportRelease.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { attemptId, organizationId },
        }),
      );
    });

    it("lets a platform super admin act across organizations", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        organizationId: otherOrganizationId,
      });
      prisma.assessmentReportRelease.update.mockResolvedValue({});

      await service.release(platformContext, attemptId);

      expect(prisma.assessmentReportRelease.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { attemptId },
        }),
      );
    });
  });

  describe("withdraw", () => {
    it("withdraws a released report with a reason", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.RELEASED,
        organizationId,
      });
      prisma.assessmentReportRelease.update.mockResolvedValue({});

      await service.withdraw(counsellorContext, attemptId, "Data quality concern");

      expect(prisma.assessmentReportRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: releaseId },
          data: expect.objectContaining({
            status: AssessmentReportReleaseStatus.WITHDRAWN,
            withdrawnReason: "Data quality concern",
          }),
        }),
      );
    });

    it("rejects withdrawing a report that has not been released", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        organizationId,
      });

      await expect(service.withdraw(counsellorContext, attemptId, "reason")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe("notes", () => {
    it("adds a note scoped to the release organization", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        organizationId,
      });
      prisma.assessmentCounsellorNote.create.mockResolvedValue({});

      await service.addNote(counsellorContext, attemptId, "Strong analytical aptitude.");

      expect(prisma.assessmentCounsellorNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            attemptId,
            organizationId,
            authorUserId: counsellorUserId,
            body: "Strong analytical aptitude.",
          },
        }),
      );
    });

    it("lists notes only after confirming scope", async () => {
      prisma.assessmentReportRelease.findFirst.mockResolvedValue({
        id: releaseId,
        status: AssessmentReportReleaseStatus.PENDING_REVIEW,
        organizationId,
      });
      prisma.assessmentCounsellorNote.findMany.mockResolvedValue([]);

      await service.listNotes(counsellorContext, attemptId);

      expect(prisma.assessmentReportRelease.findFirst).toHaveBeenCalled();
      expect(prisma.assessmentCounsellorNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { attemptId },
        }),
      );
    });
  });
});
