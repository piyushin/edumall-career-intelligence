import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentReportReleaseStatus,
  MembershipRole,
  OrganizationStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import {
  summarizeReportPayload,
  type AssessmentReportSnapshotPayload,
} from "./assessment-report-payload";
import type { AssessmentReleasedReportPdfSource } from "./assessment-report-view.service";

const releaseListSelect = {
  id: true,
  attemptId: true,
  status: true,
  reviewedAt: true,
  releasedAt: true,
  withdrawnAt: true,
  createdAt: true,
  attempt: {
    select: {
      id: true,
      submittedAt: true,
      assignment: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
          assessmentVersion: {
            select: {
              id: true,
              title: true,
              versionNumber: true,
              edition: true,
              form: true,
              language: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class AssessmentReportReviewService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listReleases(
    context: AuthContext,
    requestedOrganizationId?: string,
    status?: AssessmentReportReleaseStatus,
  ) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    return this.prisma.assessmentReportRelease.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      select: releaseListSelect,
    });
  }

  public async getReleaseDetail(context: AuthContext, attemptId: string) {
    const scope = await this.findReleaseInScope(context, attemptId);

    const release = await this.prisma.assessmentReportRelease.findUniqueOrThrow({
      where: {
        id: scope.id,
      },
      select: {
        ...releaseListSelect,
        reportDataSnapshot: {
          select: {
            id: true,
            reportVersion: true,
            generatedAt: true,
            payload: true,
          },
        },
      },
    });

    const notes = await this.prisma.assessmentCounsellorNote.findMany({
      where: {
        attemptId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        authorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return { ...release, notes };
  }

  /**
   * Lets a counsellor preview the exact candidate-facing PDF before releasing it (or
   * re-check it after release/withdrawal). Available for a release in any status, unlike
   * the candidate's own endpoint which only ever serves a RELEASED report.
   */
  public async getReleaseForPdf(
    context: AuthContext,
    attemptId: string,
  ): Promise<AssessmentReleasedReportPdfSource> {
    const scope = await this.findReleaseInScope(context, attemptId);

    const release = await this.prisma.assessmentReportRelease.findUniqueOrThrow({
      where: {
        id: scope.id,
      },
      select: {
        releasedAt: true,
        attempt: {
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
        },
        reportDataSnapshot: {
          select: {
            payload: true,
          },
        },
      },
    });

    const payload = release.reportDataSnapshot
      .payload as unknown as AssessmentReportSnapshotPayload;
    const { user, organization } = release.attempt.assignment;

    return {
      releasedAt: release.releasedAt,
      candidateName: `${user.firstName} ${user.lastName}`,
      organizationName: organization.name,
      ...summarizeReportPayload(payload),
    };
  }

  public async release(context: AuthContext, attemptId: string) {
    const release = await this.findReleaseInScope(context, attemptId);

    if (release.status !== AssessmentReportReleaseStatus.PENDING_REVIEW) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_RELEASE_NOT_PENDING",
        message: "Only a report awaiting review may be released.",
      });
    }

    const now = new Date();

    const updated = await this.prisma.assessmentReportRelease.update({
      where: {
        id: release.id,
      },
      data: {
        status: AssessmentReportReleaseStatus.RELEASED,
        reviewedByUserId: context.userId,
        reviewedAt: now,
        releasedAt: now,
      },
      select: releaseListSelect,
    });

    await this.recordAudit(
      context,
      "report.released",
      "AssessmentReportRelease",
      release.id,
      release.organizationId,
      { attemptId },
    );

    return updated;
  }

  public async withdraw(context: AuthContext, attemptId: string, reason: string) {
    const release = await this.findReleaseInScope(context, attemptId);

    if (release.status !== AssessmentReportReleaseStatus.RELEASED) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_RELEASE_NOT_RELEASED",
        message: "Only a released report may be withdrawn.",
      });
    }

    const updated = await this.prisma.assessmentReportRelease.update({
      where: {
        id: release.id,
      },
      data: {
        status: AssessmentReportReleaseStatus.WITHDRAWN,
        withdrawnAt: new Date(),
        withdrawnReason: reason,
      },
      select: releaseListSelect,
    });

    await this.recordAudit(
      context,
      "report.withdrawn",
      "AssessmentReportRelease",
      release.id,
      release.organizationId,
      { attemptId, reason },
    );

    return updated;
  }

  public async listNotes(context: AuthContext, attemptId: string) {
    await this.findReleaseInScope(context, attemptId);

    return this.prisma.assessmentCounsellorNote.findMany({
      where: {
        attemptId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        authorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  public async addNote(context: AuthContext, attemptId: string, body: string) {
    const release = await this.findReleaseInScope(context, attemptId);

    const note = await this.prisma.assessmentCounsellorNote.create({
      data: {
        attemptId,
        organizationId: release.organizationId,
        authorUserId: context.userId,
        body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        authorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // The note body itself is private counsellor content (D-010, D-012) and is
    // never written to the audit trail — only the fact that a note was added.
    await this.recordAudit(
      context,
      "report.note_added",
      "AssessmentCounsellorNote",
      note.id,
      release.organizationId,
      { attemptId },
    );

    return note;
  }

  private async findReleaseInScope(context: AuthContext, attemptId: string) {
    const scopedOrganizationId = this.scopeOrganizationId(context);

    const release = await this.prisma.assessmentReportRelease.findFirst({
      where: {
        attemptId,
        ...(scopedOrganizationId ? { organizationId: scopedOrganizationId } : {}),
      },
      select: {
        id: true,
        status: true,
        organizationId: true,
      },
    });

    if (!release) {
      throw new NotFoundException({
        code: "ASSESSMENT_REPORT_RELEASE_NOT_FOUND",
        message: "No report is available for review for this attempt.",
      });
    }

    return release;
  }

  /** Returns null for a platform-scoped SUPER_ADMIN (unrestricted), otherwise the caller's tenant. */
  private scopeOrganizationId(context: AuthContext): string | null {
    if (context.role === MembershipRole.SUPER_ADMIN) {
      return null;
    }

    return this.requireOrganizationContext(context);
  }

  private async resolveOrganizationId(
    context: AuthContext,
    requestedOrganizationId?: string,
  ): Promise<string> {
    if (context.role !== MembershipRole.SUPER_ADMIN) {
      const organizationId = this.requireOrganizationContext(context);

      if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
        throw new ForbiddenException({
          code: "ORGANIZATION_SCOPE_VIOLATION",
          message: "You cannot review reports for another organization.",
        });
      }

      return organizationId;
    }

    if (!requestedOrganizationId) {
      throw new BadRequestException({
        code: "ORGANIZATION_ID_REQUIRED",
        message: "An organization must be selected for this operation.",
      });
    }

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: requestedOrganizationId,
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException({
        code: "ORGANIZATION_NOT_FOUND",
        message: "Active organization not found.",
      });
    }

    return organization.id;
  }

  private requireOrganizationContext(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organization-scoped session is required.",
      });
    }

    return context.organizationId;
  }

  private async recordAudit(
    context: AuthContext,
    action: string,
    entityType: "AssessmentReportRelease" | "AssessmentCounsellorNote",
    entityId: string,
    organizationId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          actorUserId: context.userId,
          entityType,
          entityId,
          organizationId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit availability must not alter the report-review response.
    }
  }
}
