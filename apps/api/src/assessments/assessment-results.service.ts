import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentAttemptStatus, MembershipRole, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";

@Injectable()
export class AssessmentResultsService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listResults(context: AuthContext, requestedOrganizationId?: string) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: {
        status: AssessmentAttemptStatus.SUBMITTED,
        assignment: {
          organizationId,
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
      select: {
        id: true,
        attemptNumber: true,
        startedAt: true,
        submittedAt: true,
        assignment: {
          select: {
            id: true,
            organizationId: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            assessmentVersion: {
              select: {
                id: true,
                versionNumber: true,
                title: true,
                edition: true,
                form: true,
                language: true,
                scoringVersion: true,
                normVersion: true,
                reportVersion: true,
                assessmentDefinition: {
                  select: {
                    id: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        scoringRuns: {
          orderBy: {
            calculatedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            scoringVersion: true,
            algorithmVersion: true,
            inputHash: true,
            calculatedAt: true,
            constructScores: {
              select: {
                assessmentConstructId: true,
              },
            },
            reportDataSnapshots: {
              orderBy: {
                generatedAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                reportVersion: true,
                inputHash: true,
                generatedAt: true,
                interpretationSetId: true,
              },
            },
          },
        },
      },
    });

    return attempts.map((attempt) => {
      const scoringRun = attempt.scoringRuns[0] ?? null;
      const reportSnapshot = scoringRun?.reportDataSnapshots[0] ?? null;

      return {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        assignment: attempt.assignment,
        scoring: scoringRun
          ? {
              id: scoringRun.id,
              scoringVersion: scoringRun.scoringVersion,
              algorithmVersion: scoringRun.algorithmVersion,
              inputHash: scoringRun.inputHash,
              calculatedAt: scoringRun.calculatedAt,
              constructCount: scoringRun.constructScores.length,
            }
          : null,
        reportSnapshot,
      };
    });
  }

  public async getResult(
    context: AuthContext,
    attemptId: string,
    requestedOrganizationId?: string,
  ) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        status: AssessmentAttemptStatus.SUBMITTED,
        assignment: {
          organizationId,
        },
      },
      select: {
        id: true,
        attemptNumber: true,
        startedAt: true,
        lastActivityAt: true,
        submittedAt: true,
        assignment: {
          select: {
            id: true,
            organizationId: true,
            assignedAt: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            assessmentVersion: {
              select: {
                id: true,
                versionNumber: true,
                title: true,
                edition: true,
                form: true,
                language: true,
                scoringVersion: true,
                normVersion: true,
                reportVersion: true,
                assessmentDefinition: {
                  select: {
                    id: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        scoringRuns: {
          orderBy: {
            calculatedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            scoringVersion: true,
            algorithmVersion: true,
            inputHash: true,
            calculatedAt: true,
            constructScores: {
              orderBy: {
                assessmentConstruct: {
                  orderIndex: "asc",
                },
              },
              select: {
                assessmentConstructId: true,
                rawScore: true,
                answeredItemCount: true,
                contributionCount: true,
                assessmentConstruct: {
                  select: {
                    code: true,
                    name: true,
                    orderIndex: true,
                  },
                },
              },
            },
            reportDataSnapshots: {
              orderBy: {
                generatedAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                assessmentVersionId: true,
                interpretationSetId: true,
                reportVersion: true,
                inputHash: true,
                generatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_RESULT_NOT_FOUND",
        message: "Submitted assessment result not found.",
      });
    }

    const scoringRun = attempt.scoringRuns[0] ?? null;
    const reportSnapshot = scoringRun?.reportDataSnapshots[0] ?? null;

    return {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      lastActivityAt: attempt.lastActivityAt,
      submittedAt: attempt.submittedAt,
      assignment: attempt.assignment,
      scoring: scoringRun
        ? {
            id: scoringRun.id,
            scoringVersion: scoringRun.scoringVersion,
            algorithmVersion: scoringRun.algorithmVersion,
            inputHash: scoringRun.inputHash,
            calculatedAt: scoringRun.calculatedAt,
            constructs: scoringRun.constructScores.map((score) => ({
              assessmentConstructId: score.assessmentConstructId,
              code: score.assessmentConstruct.code,
              name: score.assessmentConstruct.name,
              orderIndex: score.assessmentConstruct.orderIndex,
              rawScore: score.rawScore.toString(),
              answeredItemCount: score.answeredItemCount,
              contributionCount: score.contributionCount,
            })),
          }
        : null,
      reportSnapshot,
    };
  }

  private async resolveOrganizationId(
    context: AuthContext,
    requestedOrganizationId?: string,
  ): Promise<string> {
    if (context.role !== MembershipRole.SUPER_ADMIN) {
      if (!context.organizationId) {
        throw new ForbiddenException({
          code: "ORGANIZATION_CONTEXT_REQUIRED",
          message: "An organization-scoped session is required.",
        });
      }

      if (requestedOrganizationId && requestedOrganizationId !== context.organizationId) {
        throw new ForbiddenException({
          code: "ORGANIZATION_SCOPE_VIOLATION",
          message: "You cannot view assessment results for another organization.",
        });
      }

      return context.organizationId;
    }

    if (!requestedOrganizationId) {
      throw new BadRequestException({
        code: "ORGANIZATION_ID_REQUIRED",
        message: "An organization must be selected.",
      });
    }

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: requestedOrganizationId,
        status: "ACTIVE",
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
}
