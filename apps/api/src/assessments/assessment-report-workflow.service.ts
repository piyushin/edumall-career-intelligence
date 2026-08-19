import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  CareerFitModelStatus,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";

function metadataString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

@Injectable()
export class AssessmentReportWorkflowService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(AssessmentNormService)
    private readonly norms: AssessmentNormService,
    @Inject(AssessmentInterpretationService)
    private readonly interpretations: AssessmentInterpretationService,
    @Inject(AssessmentReportDataService)
    private readonly reportData: AssessmentReportDataService,
  ) {}

  public async getReadiness(
    context: AuthContext,
    attemptId: string,
    requestedOrganizationId?: string,
  ) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    const attempt = await this.findSubmittedAttempt(attemptId, organizationId);

    const latestRelease = attempt.reportReleases[0] ?? null;
    const scoringRun = attempt.scoringRuns[0] ?? null;

    if (!scoringRun) {
      return {
        status: "SCORING_UNAVAILABLE" as const,
        scoringRunId: null,
        publishedNormGroups: [],
        publishedInterpretationSets: [],
        publishedCareerFitModels: [],
        latestCareerFitRun: null,
        latestSnapshot: null,
        latestRelease,
        canGenerate: false,
      };
    }

    const version = attempt.assignment.assessmentVersion;

    const [normSets, interpretationSets, publishedCareerFitModels, careerFitRun] =
      await Promise.all([
        this.prisma.assessmentNormSet.findMany({
          where: {
            assessmentVersionId: version.id,
            normVersion: version.normVersion,
            status: AssessmentNormSetStatus.PUBLISHED,
          },
          orderBy: {
            publishedAt: "desc",
          },
          select: {
            id: true,
            name: true,
            normVersion: true,
            sourceReference: true,
            groups: {
              orderBy: {
                code: "asc",
              },
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                sampleSize: true,
              },
            },
          },
        }),
        this.prisma.assessmentInterpretationSet.findMany({
          where: {
            assessmentVersionId: version.id,
            status: AssessmentInterpretationSetStatus.PUBLISHED,
          },
          orderBy: {
            publishedAt: "desc",
          },
          select: {
            id: true,
            version: true,
            name: true,
            description: true,
            sourceReference: true,
          },
        }),
        this.prisma.careerFitModel.findMany({
          where: {
            assessmentVersionId: version.id,
            status: CareerFitModelStatus.PUBLISHED,
          },
          orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
          select: {
            id: true,
            version: true,
            name: true,
            description: true,
            algorithmKey: true,
            algorithmVersion: true,
            sourceReference: true,
          },
        }),
        this.prisma.careerFitRun.findFirst({
          where: { scoringRunId: scoringRun.id },
          orderBy: { calculatedAt: "desc" },
          select: {
            id: true,
            careerFitModelId: true,
            algorithmKey: true,
            algorithmVersion: true,
            calculatedAt: true,
            metadata: true,
          },
        }),
      ]);

    const publishedNormGroups = normSets.flatMap((normSet) =>
      normSet.groups.map((group) => ({
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
        sampleSize: group.sampleSize,
        normSetId: normSet.id,
        normSetName: normSet.name,
        normVersion: normSet.normVersion,
        sourceReference: normSet.sourceReference,
      })),
    );

    const latestSnapshot = scoringRun.reportDataSnapshots[0] ?? null;
    const latestCareerFitRun = careerFitRun
      ? {
          id: careerFitRun.id,
          careerFitModelId: careerFitRun.careerFitModelId,
          algorithmKey: careerFitRun.algorithmKey,
          algorithmVersion: careerFitRun.algorithmVersion,
          calculatedAt: careerFitRun.calculatedAt,
          normGroupId: metadataString(careerFitRun.metadata, "normGroupId"),
        }
      : null;

    const canGenerate =
      publishedNormGroups.length > 0 &&
      interpretationSets.length > 0 &&
      publishedCareerFitModels.length > 0;

    return {
      status: latestSnapshot
        ? ("GENERATED" as const)
        : canGenerate
          ? ("READY" as const)
          : ("NOT_READY" as const),
      scoringRunId: scoringRun.id,
      publishedNormGroups,
      publishedInterpretationSets: interpretationSets,
      publishedCareerFitModels,
      latestCareerFitRun,
      latestSnapshot,
      latestRelease,
      canGenerate,
    };
  }

  public async generate(
    context: AuthContext,
    attemptId: string,
    normGroupId: string,
    interpretationSetId: string,
    requestedOrganizationId?: string,
  ) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    const attempt = await this.findSubmittedAttempt(attemptId, organizationId);

    const scoringRun = attempt.scoringRuns[0];

    if (!scoringRun) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_SCORING_UNAVAILABLE",
        message: "A deterministic scoring run is required before report data can be generated.",
      });
    }

    const careerFitRun = await this.prisma.careerFitRun.findFirst({
      where: { scoringRunId: scoringRun.id },
      orderBy: { calculatedAt: "desc" },
      select: { id: true, metadata: true },
    });

    if (!careerFitRun) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_CAREER_FIT_REQUIRED",
        message: "Calculate deterministic CareerFit before generating the governed report.",
      });
    }

    if (metadataString(careerFitRun.metadata, "normGroupId") !== normGroupId) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_CAREER_FIT_NORM_MISMATCH",
        message:
          "CareerFit must be calculated with the same published norm group used for the report.",
      });
    }

    await this.norms.applyPublishedNormGroup(scoringRun.id, normGroupId);

    await this.interpretations.applyPublishedInterpretationSet(
      scoringRun.id,
      normGroupId,
      interpretationSetId,
    );

    const snapshot = await this.reportData.createSnapshot(
      scoringRun.id,
      normGroupId,
      interpretationSetId,
    );

    return {
      id: snapshot.id,
      scoringRunId: snapshot.scoringRunId,
      assessmentVersionId: snapshot.assessmentVersionId,
      interpretationSetId: snapshot.interpretationSetId,
      reportVersion: snapshot.reportVersion,
      inputHash: snapshot.inputHash,
      payload: snapshot.payload,
      generatedAt: snapshot.generatedAt,
    };
  }

  private async findSubmittedAttempt(attemptId: string, organizationId: string) {
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
        assignment: {
          select: {
            assessmentVersion: {
              select: {
                id: true,
                normVersion: true,
              },
            },
          },
        },
        reportReleases: {
          orderBy: {
            releasedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            reportDataSnapshotId: true,
            releasedByUserId: true,
            reviewedAt: true,
            releasedAt: true,
          },
        },
        scoringRuns: {
          orderBy: {
            calculatedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            reportDataSnapshots: {
              orderBy: {
                generatedAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                scoringRunId: true,
                assessmentVersionId: true,
                interpretationSetId: true,
                reportVersion: true,
                inputHash: true,
                payload: true,
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

    return attempt;
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
          message: "You cannot generate assessment reports for another organization.",
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
