import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MembershipRole, Prisma, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { AssessmentReportWorkflowService } from "./assessment-report-workflow.service";

@Injectable()
export class AssessmentReportReleaseService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(AssessmentReportWorkflowService)
    private readonly workflow: AssessmentReportWorkflowService,
  ) {}

  public async release(context: AuthContext, attemptId: string, requestedOrganizationId?: string) {
    const readiness = await this.workflow.getReadiness(context, attemptId, requestedOrganizationId);
    const snapshot = readiness.latestSnapshot;

    if (!snapshot) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SNAPSHOT_REQUIRED",
        message: "Generate the governed report snapshot before releasing it to the candidate.",
      });
    }

    this.assertCandidateReleaseSnapshot(snapshot.payload);

    const organizationId = this.resolveStaffOrganizationId(context, requestedOrganizationId);
    const existing = await this.findExistingRelease(attemptId, snapshot.id);

    if (existing) {
      return existing;
    }

    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.assessmentReportRelease.create({
          data: {
            organizationId,
            attemptId,
            reportDataSnapshotId: snapshot.id,
            releasedByUserId: context.userId,
            reviewedAt: now,
            releasedAt: now,
            metadata: {
              reportVersion: snapshot.reportVersion,
              reportInputHash: snapshot.inputHash,
              releasePolicy: "reviewed-immutable-snapshot-v1",
            },
          },
          select: {
            id: true,
            organizationId: true,
            attemptId: true,
            reportDataSnapshotId: true,
            releasedByUserId: true,
            reviewedAt: true,
            releasedAt: true,
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId: context.userId,
            action: "assessment_report.released",
            entityType: "AssessmentReportRelease",
            entityId: created.id,
            metadata: {
              attemptId,
              reportDataSnapshotId: snapshot.id,
              reportVersion: snapshot.reportVersion,
              reportInputHash: snapshot.inputHash,
            },
          },
        });

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.findExistingRelease(attemptId, snapshot.id);
        if (duplicate) {
          return duplicate;
        }
      }

      throw error;
    }
  }

  public async getCandidateReleasedSnapshot(context: AuthContext, attemptId: string) {
    const organizationId = this.requireCandidateOrganizationId(context);

    const release = await this.prisma.assessmentReportRelease.findFirst({
      where: {
        organizationId,
        attemptId,
        attempt: {
          assignment: {
            organizationId,
            userId: context.userId,
          },
        },
      },
      orderBy: {
        releasedAt: "desc",
      },
      select: {
        id: true,
        reviewedAt: true,
        releasedAt: true,
        reportDataSnapshot: {
          select: {
            id: true,
            inputHash: true,
            reportVersion: true,
            generatedAt: true,
            payload: true,
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException({
        code: "ASSESSMENT_REPORT_RELEASE_NOT_FOUND",
        message: "No released report is available for this assessment attempt.",
      });
    }

    return release;
  }

  private async findExistingRelease(attemptId: string, reportDataSnapshotId: string) {
    return this.prisma.assessmentReportRelease.findUnique({
      where: {
        attemptId_reportDataSnapshotId: {
          attemptId,
          reportDataSnapshotId,
        },
      },
      select: {
        id: true,
        organizationId: true,
        attemptId: true,
        reportDataSnapshotId: true,
        releasedByUserId: true,
        reviewedAt: true,
        releasedAt: true,
      },
    });
  }

  private assertCandidateReleaseSnapshot(payload: unknown) {
    if (typeof payload !== "object" || payload === null) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_V3_REQUIRED",
        message: "Only a governed Career Intelligence v3 snapshot may be released to a candidate.",
      });
    }

    const record = payload as Record<string, unknown>;

    if (record.schemaVersion !== "assessment-report-data-v3") {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_V3_REQUIRED",
        message: "Only a governed Career Intelligence v3 snapshot may be released to a candidate.",
      });
    }

    const careerFit = record.careerFit;
    const rankedCareerPaths =
      typeof careerFit === "object" && careerFit !== null
        ? (careerFit as Record<string, unknown>).rankedCareerPaths
        : null;

    if (!Array.isArray(rankedCareerPaths) || rankedCareerPaths.length === 0) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_CAREER_FIT_REQUIRED",
        message: "A deterministic CareerFit result is required before the report can be released.",
      });
    }
  }

  private resolveStaffOrganizationId(
    context: AuthContext,
    requestedOrganizationId?: string,
  ): string {
    if (context.role === MembershipRole.SUPER_ADMIN) {
      if (!requestedOrganizationId) {
        throw new BadRequestException({
          code: "ORGANIZATION_ID_REQUIRED",
          message: "An organization must be selected.",
        });
      }

      return requestedOrganizationId;
    }

    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organization-scoped session is required.",
      });
    }

    if (requestedOrganizationId && requestedOrganizationId !== context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_SCOPE_VIOLATION",
        message: "You cannot release assessment reports for another organization.",
      });
    }

    return context.organizationId;
  }

  private requireCandidateOrganizationId(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organization-scoped session is required.",
      });
    }

    return context.organizationId;
  }
}
