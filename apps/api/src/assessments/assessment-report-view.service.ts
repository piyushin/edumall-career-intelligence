import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AssessmentReportReleaseStatus, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";

/**
 * Shape written by AssessmentReportDataService.createSnapshot. Only the fields the
 * candidate-facing summary reads are declared here.
 */
interface AssessmentReportSnapshotPayload {
  assessment: {
    title: string;
    edition: string;
    form: string;
    language: string;
  };
  scoring: {
    constructs: Array<{
      assessmentConstructId: string;
      code: string;
      name: string;
    }>;
  };
  interpretation: {
    applications: Array<{
      assessmentConstructId: string;
      ruleCode: string;
      outputData: unknown;
    }>;
  };
}

export type AssessmentReportView =
  | { status: "PENDING" }
  | { status: "WITHDRAWN" }
  | {
      status: "RELEASED";
      releasedAt: Date | null;
      assessment: {
        title: string;
        edition: string;
        form: string;
        language: string;
      };
      results: Array<{
        constructCode: string | null;
        constructName: string | null;
        outputData: unknown;
      }>;
    };

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

    const constructsById = new Map(
      payload.scoring.constructs.map((construct) => [construct.assessmentConstructId, construct]),
    );

    return {
      status: "RELEASED",
      releasedAt: release.releasedAt,
      assessment: {
        title: payload.assessment.title,
        edition: payload.assessment.edition,
        form: payload.assessment.form,
        language: payload.assessment.language,
      },
      results: payload.interpretation.applications.map((application) => {
        const construct = constructsById.get(application.assessmentConstructId);

        return {
          constructCode: construct?.code ?? null,
          constructName: construct?.name ?? null,
          outputData: application.outputData,
        };
      }),
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
