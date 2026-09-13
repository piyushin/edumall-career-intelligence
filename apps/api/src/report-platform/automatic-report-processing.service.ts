import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  AssessmentReportConfigurationStatus,
  AssessmentReportGenerationStatus,
  CareerFitModelStatus,
  CareerTaxonomyVersionStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { AssessmentInterpretationService } from "../assessments/assessment-interpretation.service";
import { AssessmentReportDataService } from "../assessments/assessment-report-data.service";
import { CareerFitExecutionService } from "../career-intelligence/career-fit-execution.service";
import { DATABASE_PRISMA } from "../database/database.tokens";

const CONFIGURATION_ERROR_CODE = "REPORT_CONFIGURATION_UNAVAILABLE";
const CONFIGURATION_ERROR_MESSAGE =
  "The scientific configuration required for this report is not currently available.";
const PROCESSING_ERROR_CODE = "REPORT_PROCESSING_FAILED";
const PROCESSING_ERROR_MESSAGE =
  "The report could not be generated. It can be retried without resubmitting the assessment.";

@Injectable()
export class AutomaticReportProcessingService {
  public constructor(
    @Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient,
    @Inject(CareerFitExecutionService) private readonly careerFit: CareerFitExecutionService,
    @Inject(AssessmentInterpretationService)
    private readonly interpretations: AssessmentInterpretationService,
    @Inject(AssessmentReportDataService)
    private readonly reportData: AssessmentReportDataService,
  ) {}

  public async processSubmittedAttempt(attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        assignment: {
          select: {
            organizationId: true,
            userId: true,
            assessmentVersionId: true,
            assessmentVersion: { select: { normVersion: true } },
          },
        },
        reportGeneration: {
          select: {
            id: true,
            status: true,
            attemptCount: true,
            reportDataSnapshotId: true,
            reportDataSnapshot: { select: { id: true } },
          },
        },
        scoringRuns: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
        message: "Assessment attempt not found.",
      });
    }

    if (attempt.status !== AssessmentAttemptStatus.SUBMITTED) {
      throw new ConflictException({
        code: "ASSESSMENT_ATTEMPT_NOT_SUBMITTED",
        message: "Only a submitted assessment attempt can be processed.",
      });
    }

    if (
      attempt.reportGeneration?.status === AssessmentReportGenerationStatus.GENERATED &&
      attempt.reportGeneration.reportDataSnapshotId &&
      attempt.reportGeneration.reportDataSnapshot
    ) {
      return {
        generationId: attempt.reportGeneration.id,
        status: AssessmentReportGenerationStatus.GENERATED,
        reportDataSnapshotId: attempt.reportGeneration.reportDataSnapshotId,
        reused: true,
      };
    }

    const generation = await this.startProcessing(attempt);

    try {
      const scoringRun = attempt.scoringRuns[0];

      if (!scoringRun) {
        throw new ConflictException({
          code: "ASSESSMENT_REPORT_SCORING_UNAVAILABLE",
          message: "A deterministic scoring run is required before report processing.",
        });
      }

      const configurations = await this.prisma.assessmentReportConfiguration.findMany({
        where: {
          assessmentVersionId: attempt.assignment.assessmentVersionId,
          status: AssessmentReportConfigurationStatus.ACTIVE,
        },
        take: 2,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          assessmentVersionId: true,
          normGroupId: true,
          interpretationSetId: true,
          careerFitModelId: true,
          reportTemplateVersion: true,
          normGroup: {
            select: {
              normSet: {
                select: { assessmentVersionId: true, normVersion: true, status: true },
              },
            },
          },
          interpretationSet: { select: { assessmentVersionId: true, status: true } },
          careerFitModel: {
            select: {
              assessmentVersionId: true,
              status: true,
              careerTaxonomyVersion: { select: { status: true } },
            },
          },
        },
      });

      const configuration = configurations.length === 1 ? configurations[0] : null;

      if (
        !configuration ||
        !this.isConfigurationReady(configuration, attempt.assignment.assessmentVersion.normVersion)
      ) {
        return this.blockConfiguration(generation.id, attempt);
      }

      await this.prisma.assessmentReportGeneration.update({
        where: { id: generation.id },
        data: { configurationId: configuration.id },
      });

      await this.careerFit.executeAutomatic(
        attemptId,
        configuration.normGroupId,
        configuration.careerFitModelId,
      );
      await this.interpretations.applyPublishedInterpretationSet(
        scoringRun.id,
        configuration.normGroupId,
        configuration.interpretationSetId,
      );
      const snapshot = await this.reportData.createSnapshot(
        scoringRun.id,
        configuration.normGroupId,
        configuration.interpretationSetId,
        {
          id: configuration.id,
          careerFitModelId: configuration.careerFitModelId,
          reportTemplateVersion: configuration.reportTemplateVersion,
        },
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.assessmentReportGeneration.update({
          where: { id: generation.id },
          data: {
            status: AssessmentReportGenerationStatus.GENERATED,
            configurationId: configuration.id,
            reportDataSnapshotId: snapshot.id,
            completedAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: attempt.assignment.organizationId,
            actorUserId: null,
            subjectUserId: attempt.assignment.userId,
            action: "report.processing.generated",
            entityType: "AssessmentReportGeneration",
            entityId: generation.id,
            metadata: {
              attemptId,
              configurationId: configuration.id,
              scoringRunId: scoringRun.id,
              reportDataSnapshotId: snapshot.id,
              systemActor: true,
            },
          },
        });
      });

      return {
        generationId: generation.id,
        status: AssessmentReportGenerationStatus.GENERATED,
        reportDataSnapshotId: snapshot.id,
        reused: false,
      };
    } catch (error) {
      return this.failProcessing(generation.id, attempt, error);
    }
  }

  private async startProcessing(attempt: {
    id: string;
    assignment: { organizationId: string; userId: string };
    reportGeneration: { attemptCount: number } | null;
  }) {
    const now = new Date();
    const retry = (attempt.reportGeneration?.attemptCount ?? 0) > 0;

    return this.prisma.$transaction(async (tx) => {
      const generation = await tx.assessmentReportGeneration.upsert({
        where: { attemptId: attempt.id },
        create: {
          attemptId: attempt.id,
          status: AssessmentReportGenerationStatus.PROCESSING,
          attemptCount: 1,
          startedAt: now,
          lastAttemptAt: now,
        },
        update: {
          status: AssessmentReportGenerationStatus.PROCESSING,
          attemptCount: { increment: 1 },
          startedAt: now,
          lastAttemptAt: now,
          completedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
        select: { id: true, attemptCount: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId: attempt.assignment.organizationId,
          actorUserId: null,
          subjectUserId: attempt.assignment.userId,
          action: retry ? "report.processing.retried" : "report.processing.started",
          entityType: "AssessmentReportGeneration",
          entityId: generation.id,
          metadata: {
            attemptId: attempt.id,
            attemptCount: generation.attemptCount,
            systemActor: true,
          },
        },
      });
      return generation;
    });
  }

  private isConfigurationReady(
    configuration: {
      assessmentVersionId: string;
      normGroup: {
        normSet: {
          assessmentVersionId: string;
          normVersion: string;
          status: AssessmentNormSetStatus;
        };
      };
      interpretationSet: {
        assessmentVersionId: string;
        status: AssessmentInterpretationSetStatus;
      };
      careerFitModel: {
        assessmentVersionId: string;
        status: CareerFitModelStatus;
        careerTaxonomyVersion: { status: CareerTaxonomyVersionStatus };
      };
    },
    expectedNormVersion: string,
  ): boolean {
    return (
      configuration.normGroup.normSet.assessmentVersionId === configuration.assessmentVersionId &&
      configuration.normGroup.normSet.normVersion === expectedNormVersion &&
      configuration.normGroup.normSet.status === AssessmentNormSetStatus.PUBLISHED &&
      configuration.interpretationSet.assessmentVersionId === configuration.assessmentVersionId &&
      configuration.interpretationSet.status === AssessmentInterpretationSetStatus.PUBLISHED &&
      configuration.careerFitModel.assessmentVersionId === configuration.assessmentVersionId &&
      configuration.careerFitModel.status === CareerFitModelStatus.PUBLISHED &&
      configuration.careerFitModel.careerTaxonomyVersion.status ===
        CareerTaxonomyVersionStatus.PUBLISHED
    );
  }

  private async blockConfiguration(
    generationId: string,
    attempt: { id: string; assignment: { organizationId: string; userId: string } },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentReportGeneration.update({
        where: { id: generationId },
        data: {
          status: AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION,
          configurationId: null,
          completedAt: null,
          lastErrorCode: CONFIGURATION_ERROR_CODE,
          lastErrorMessage: CONFIGURATION_ERROR_MESSAGE,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: attempt.assignment.organizationId,
          actorUserId: null,
          subjectUserId: attempt.assignment.userId,
          action: "report.processing.blocked_configuration",
          entityType: "AssessmentReportGeneration",
          entityId: generationId,
          metadata: {
            attemptId: attempt.id,
            errorCode: CONFIGURATION_ERROR_CODE,
            systemActor: true,
          },
        },
      });
    });
    return {
      generationId,
      status: AssessmentReportGenerationStatus.BLOCKED_CONFIGURATION,
      reportDataSnapshotId: null,
      reused: false,
    };
  }

  private async failProcessing(
    generationId: string,
    attempt: { id: string; assignment: { organizationId: string; userId: string } },
    error: unknown,
  ) {
    const internalCode = this.internalErrorCode(error);

    await this.prisma.$transaction(async (tx) => {
      await tx.assessmentReportGeneration.update({
        where: { id: generationId },
        data: {
          status: AssessmentReportGenerationStatus.FAILED,
          completedAt: null,
          lastErrorCode: PROCESSING_ERROR_CODE,
          lastErrorMessage: PROCESSING_ERROR_MESSAGE,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: attempt.assignment.organizationId,
          actorUserId: null,
          subjectUserId: attempt.assignment.userId,
          action: "report.processing.failed",
          entityType: "AssessmentReportGeneration",
          entityId: generationId,
          metadata: {
            attemptId: attempt.id,
            errorCode: PROCESSING_ERROR_CODE,
            internalErrorCode: internalCode,
            systemActor: true,
          },
        },
      });
    });

    return {
      generationId,
      status: AssessmentReportGenerationStatus.FAILED,
      reportDataSnapshotId: null,
      reused: false,
    };
  }

  private internalErrorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === "object" && response !== null && "code" in response) {
        const code = (response as { code?: unknown }).code;
        if (typeof code === "string" && /^[A-Z0-9_]{1,120}$/.test(code)) return code;
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
    return "UNEXPECTED_ERROR";
  }
}
