import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AssessmentInterpretationSetStatus, Prisma, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { DATABASE_PRISMA } from "../database/database.tokens";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();

  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
}

@Injectable()
export class AssessmentReportDataService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async createSnapshot(
    scoringRunId: string,
    normGroupId: string,
    interpretationSetId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const scoringRun = await tx.assessmentScoringRun.findUnique({
        where: {
          id: scoringRunId,
        },
        select: {
          id: true,
          scoringVersion: true,
          algorithmVersion: true,
          inputHash: true,
          calculatedAt: true,
          attempt: {
            select: {
              id: true,
              startedAt: true,
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
                          code: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          constructScores: {
            orderBy: {
              assessmentConstructId: "asc",
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
        },
      });

      if (!scoringRun) {
        throw new NotFoundException({
          code: "ASSESSMENT_SCORING_RUN_NOT_FOUND",
          message: "Assessment scoring run not found.",
        });
      }

      const version = scoringRun.attempt.assignment.assessmentVersion;

      const interpretationSet = await tx.assessmentInterpretationSet.findUnique({
        where: {
          id: interpretationSetId,
        },
        select: {
          id: true,
          version: true,
          name: true,
          assessmentVersionId: true,
          status: true,
        },
      });

      if (!interpretationSet) {
        throw new NotFoundException({
          code: "ASSESSMENT_INTERPRETATION_SET_NOT_FOUND",
          message: "Assessment interpretation set not found.",
        });
      }

      if (interpretationSet.status !== AssessmentInterpretationSetStatus.PUBLISHED) {
        throw new ConflictException({
          code: "ASSESSMENT_INTERPRETATION_SET_NOT_PUBLISHED",
          message: "Only a published interpretation set may be used for report data.",
        });
      }

      if (interpretationSet.assessmentVersionId !== version.id) {
        throw new ConflictException({
          code: "ASSESSMENT_REPORT_INTERPRETATION_VERSION_MISMATCH",
          message: "Interpretation set does not belong to the scoring run assessment version.",
        });
      }

      const normApplications = await tx.assessmentNormApplication.findMany({
        where: {
          scoringRunId,
          normGroupId,
        },
        orderBy: {
          assessmentConstructId: "asc",
        },
        select: {
          id: true,
          assessmentConstructId: true,
          normSetId: true,
          normGroupId: true,
          constructNormTableId: true,
          normLookupRowId: true,
          rawScore: true,
          standardizedScore: true,
          percentile: true,
          appliedAt: true,
        },
      });

      if (normApplications.length === 0) {
        throw new ConflictException({
          code: "ASSESSMENT_REPORT_NORM_DATA_MISSING",
          message: "No norm applications exist for the selected norm group.",
        });
      }

      const interpretationApplications = await tx.assessmentInterpretationApplication.findMany({
        where: {
          normApplication: {
            scoringRunId,
            normGroupId,
          },
          interpretationRule: {
            interpretationSetId,
          },
        },
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          normApplicationId: true,
          interpretationRuleId: true,
          metricValue: true,
          outputData: true,
          appliedAt: true,
          interpretationRule: {
            select: {
              code: true,
              metric: true,
              priority: true,
              assessmentConstructId: true,
            },
          },
        },
      });

      const normApplicationIds = new Set(normApplications.map((application) => application.id));
      const interpretedNormApplicationIds = new Set(
        interpretationApplications.map((application) => application.normApplicationId),
      );

      if (
        interpretationApplications.length !== normApplications.length ||
        interpretedNormApplicationIds.size !== normApplicationIds.size ||
        [...normApplicationIds].some(
          (normApplicationId) => !interpretedNormApplicationIds.has(normApplicationId),
        )
      ) {
        throw new ConflictException({
          code: "ASSESSMENT_REPORT_INTERPRETATION_DATA_INCOMPLETE",
          message:
            "Every normalized construct result must have exactly one interpretation application before report data is generated.",
        });
      }

      const payload = {
        schemaVersion: "assessment-report-data-v2",
        candidate: {
          userId: scoringRun.attempt.assignment.user.id,
          email: scoringRun.attempt.assignment.user.email,
          firstName: scoringRun.attempt.assignment.user.firstName,
          lastName: scoringRun.attempt.assignment.user.lastName,
        },
        submission: {
          attemptId: scoringRun.attempt.id,
          startedAt: scoringRun.attempt.startedAt.toISOString(),
          submittedAt: scoringRun.attempt.submittedAt?.toISOString() ?? null,
        },
        assessment: {
          assessmentVersionId: version.id,
          assessmentDefinitionCode: version.assessmentDefinition.code,
          versionNumber: version.versionNumber,
          title: version.title,
          edition: version.edition,
          form: version.form,
          language: version.language,
          scoringVersion: version.scoringVersion,
          normVersion: version.normVersion,
          reportVersion: version.reportVersion,
        },
        scoring: {
          scoringRunId: scoringRun.id,
          attemptId: scoringRun.attempt.id,
          scoringVersion: scoringRun.scoringVersion,
          algorithmVersion: scoringRun.algorithmVersion,
          scoringInputHash: scoringRun.inputHash,
          calculatedAt: scoringRun.calculatedAt.toISOString(),
          constructs: scoringRun.constructScores.map((score) => ({
            assessmentConstructId: score.assessmentConstructId,
            code: score.assessmentConstruct.code,
            name: score.assessmentConstruct.name,
            orderIndex: score.assessmentConstruct.orderIndex,
            rawScore: score.rawScore.toString(),
            answeredItemCount: score.answeredItemCount,
            contributionCount: score.contributionCount,
          })),
        },
        norms: normApplications.map((application) => ({
          id: application.id,
          assessmentConstructId: application.assessmentConstructId,
          normSetId: application.normSetId,
          normGroupId: application.normGroupId,
          constructNormTableId: application.constructNormTableId,
          normLookupRowId: application.normLookupRowId,
          rawScore: application.rawScore.toString(),
          standardizedScore: application.standardizedScore?.toString() ?? null,
          percentile: application.percentile?.toString() ?? null,
          appliedAt: application.appliedAt.toISOString(),
        })),
        interpretation: {
          interpretationSetId: interpretationSet.id,
          version: interpretationSet.version,
          name: interpretationSet.name,
          applications: interpretationApplications.map((application) => ({
            id: application.id,
            normApplicationId: application.normApplicationId,
            interpretationRuleId: application.interpretationRuleId,
            assessmentConstructId: application.interpretationRule.assessmentConstructId,
            ruleCode: application.interpretationRule.code,
            metric: application.interpretationRule.metric,
            priority: application.interpretationRule.priority,
            metricValue: application.metricValue.toString(),
            outputData: application.outputData,
            appliedAt: application.appliedAt.toISOString(),
          })),
        },
      };

      const canonicalPayload = canonicalize(payload);
      const inputHash = createHash("sha256").update(canonicalPayload).digest("hex");

      const existing = await tx.assessmentReportDataSnapshot.findUnique({
        where: {
          scoringRunId_reportVersion_inputHash: {
            scoringRunId,
            reportVersion: version.reportVersion,
            inputHash,
          },
        },
      });

      if (existing) {
        return existing;
      }

      return tx.assessmentReportDataSnapshot.create({
        data: {
          scoringRunId,
          assessmentVersionId: version.id,
          interpretationSetId,
          reportVersion: version.reportVersion,
          inputHash,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    });
  }
}
