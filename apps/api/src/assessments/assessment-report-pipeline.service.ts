import { ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  AssessmentInterpretationSetStatus,
  AssessmentNormSetStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";
import { AssessmentScoringService } from "./assessment-scoring.service";

export type AssessmentReportPipelineNotReadyReason =
  "NORM_SET_NOT_PUBLISHED" | "NORM_GROUP_MISSING" | "INTERPRETATION_SET_NOT_PUBLISHED";

export type AssessmentReportPipelineResult =
  | {
      generated: true;
      scoringRunId: string;
      snapshotId: string;
      releaseId: string;
    }
  | {
      generated: false;
      reason: AssessmentReportPipelineNotReadyReason;
    };

/**
 * Orchestrates scoring -> norm application -> interpretation application -> report-data
 * snapshot -> counsellor review gate for one submitted attempt.
 *
 * V1 assumes exactly one norm group per published norm set (single-cohort pilot scope,
 * see D-002/D-004). If that assumption is ever violated by content authoring, this throws
 * rather than silently picking a group, so a mis-scored report is never produced.
 */
@Injectable()
export class AssessmentReportPipelineService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(AssessmentScoringService)
    private readonly scoring: AssessmentScoringService,
    @Inject(AssessmentNormService)
    private readonly norm: AssessmentNormService,
    @Inject(AssessmentInterpretationService)
    private readonly interpretation: AssessmentInterpretationService,
    @Inject(AssessmentReportDataService)
    private readonly reportData: AssessmentReportDataService,
  ) {}

  public async generateReportIfReady(attemptId: string): Promise<AssessmentReportPipelineResult> {
    const scoringRun = await this.scoring.scoreSubmittedAttempt(attemptId);

    const scoped = await this.prisma.assessmentScoringRun.findUniqueOrThrow({
      where: {
        id: scoringRun.id,
      },
      select: {
        attempt: {
          select: {
            assignment: {
              select: {
                organizationId: true,
                assessmentVersionId: true,
                assessmentVersion: {
                  select: {
                    normVersion: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const { organizationId, assessmentVersionId, assessmentVersion } = scoped.attempt.assignment;

    const normSet = await this.prisma.assessmentNormSet.findUnique({
      where: {
        assessmentVersionId_normVersion: {
          assessmentVersionId,
          normVersion: assessmentVersion.normVersion,
        },
      },
      select: {
        status: true,
        groups: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!normSet || normSet.status !== AssessmentNormSetStatus.PUBLISHED) {
      return { generated: false, reason: "NORM_SET_NOT_PUBLISHED" };
    }

    if (normSet.groups.length === 0) {
      return { generated: false, reason: "NORM_GROUP_MISSING" };
    }

    if (normSet.groups.length > 1) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_NORM_GROUP_AMBIGUOUS",
        message:
          "Multiple norm groups are published for this assessment version. Report generation requires exactly one.",
      });
    }

    const [normGroup] = normSet.groups;

    if (!normGroup) {
      return { generated: false, reason: "NORM_GROUP_MISSING" };
    }

    const interpretationSets = await this.prisma.assessmentInterpretationSet.findMany({
      where: {
        assessmentVersionId,
        status: AssessmentInterpretationSetStatus.PUBLISHED,
      },
      select: {
        id: true,
      },
    });

    if (interpretationSets.length === 0) {
      return { generated: false, reason: "INTERPRETATION_SET_NOT_PUBLISHED" };
    }

    if (interpretationSets.length > 1) {
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_INTERPRETATION_SET_AMBIGUOUS",
        message:
          "Multiple interpretation sets are published for this assessment version. Report generation requires exactly one.",
      });
    }

    const [interpretationSet] = interpretationSets;

    if (!interpretationSet) {
      return { generated: false, reason: "INTERPRETATION_SET_NOT_PUBLISHED" };
    }

    await this.norm.applyPublishedNormGroup(scoringRun.id, normGroup.id);

    await this.interpretation.applyPublishedInterpretationSet(
      scoringRun.id,
      normGroup.id,
      interpretationSet.id,
    );

    const snapshot = await this.reportData.createSnapshot(
      scoringRun.id,
      normGroup.id,
      interpretationSet.id,
    );

    const existingRelease = await this.prisma.assessmentReportRelease.findUnique({
      where: {
        attemptId,
      },
      select: {
        id: true,
      },
    });

    const release = await this.prisma.assessmentReportRelease.upsert({
      where: {
        attemptId,
      },
      create: {
        attemptId,
        organizationId,
        reportDataSnapshotId: snapshot.id,
      },
      update: {},
      select: {
        id: true,
      },
    });

    if (!existingRelease) {
      await this.recordAudit(release.id, organizationId, { attemptId });
    }

    return {
      generated: true,
      scoringRunId: scoringRun.id,
      snapshotId: snapshot.id,
      releaseId: release.id,
    };
  }

  private async recordAudit(
    releaseId: string,
    organizationId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: "report.generated",
          actorUserId: null,
          entityType: "AssessmentReportRelease",
          entityId: releaseId,
          organizationId,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit availability must not alter report generation.
    }
  }
}
