import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentReportReleaseStatus, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import {
  summarizeReportPayload,
  type AssessmentReleasedReportSummary,
  type AssessmentReportSnapshotPayload,
} from "./assessment-report-payload";

export type AssessmentReportView =
  | { status: "PENDING" }
  | { status: "WITHDRAWN" }
  | ({
      status: "RELEASED";
      releasedAt: Date | null;
    } & AssessmentReleasedReportSummary);

export interface AssessmentReleasedReportPdfSource extends AssessmentReleasedReportSummary {
  releasedAt: Date | null;
  candidateName: string;
  organizationName: string;
}

/**
 * Candidate self-service report view. Only ever returns the student-friendly summary
 * (construct name + the published interpretation rule's approved output) once the
 * counsellor review has reached RELEASED (D-007, D-008). Never exposes raw/standardized
 * scores, percentiles, or norm/interpretation provenance ids.
 */
@Injectable()
export class AssessmentReportViewService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async getMyReport(context: AuthContext, attemptId: string): Promise<AssessmentReportView> {
    const organizationId = this.requireOrganization(context);

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        assignment: {
          organizationId,
          userId: context.userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
        message: "Assessment attempt not found.",
      });
    }

    const release = await this.prisma.assessmentReportRelease.findUnique({
      where: {
        attemptId,
      },
      select: {
        status: true,
        releasedAt: true,
        reportDataSnapshot: {
          select: {
            payload: true,
          },
        },
      },
    });

    if (!release || release.status === AssessmentReportReleaseStatus.PENDING_REVIEW) {
      return { status: "PENDING" };
    }

    if (release.status === AssessmentReportReleaseStatus.WITHDRAWN) {
      return { status: "WITHDRAWN" };
    }

    const payload = release.reportDataSnapshot
      .payload as unknown as AssessmentReportSnapshotPayload;

    return {
      status: "RELEASED",
      releasedAt: release.releasedAt,
      ...summarizeReportPayload(payload),
    };
  }

  /**
   * Same RELEASED-only gate as getMyReport, but throws instead of returning a
   * PENDING/WITHDRAWN shape (there is no useful PDF for those), and additionally
   * resolves the candidate and organization names for the document header.
   */
  public async getReleasedReportForPdf(
    context: AuthContext,
    attemptId: string,
  ): Promise<AssessmentReleasedReportPdfSource> {
    const organizationId = this.requireOrganization(context);

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        assignment: {
          organizationId,
          userId: context.userId,
        },
      },
      select: {
        assignment: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            organization: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
        message: "Assessment attempt not found.",
      });
    }

    const release = await this.prisma.assessmentReportRelease.findUnique({
      where: {
        attemptId,
      },
      select: {
        status: true,
        releasedAt: true,
        reportDataSnapshot: {
          select: {
            payload: true,
          },
        },
      },
    });

    if (!release || release.status !== AssessmentReportReleaseStatus.RELEASED) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_NOT_RELEASED",
        message: "This report has not been released yet.",
      });
    }

    const payload = release.reportDataSnapshot
      .payload as unknown as AssessmentReportSnapshotPayload;

    const { user, organization } = attempt.assignment;

    return {
      releasedAt: release.releasedAt,
      candidateName: `${user.firstName} ${user.lastName}`,
      organizationName: organization.name,
      ...summarizeReportPayload(payload),
    };
  }

  private requireOrganization(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organization-scoped session is required.",
      });
    }

    return context.organizationId;
  }
}
