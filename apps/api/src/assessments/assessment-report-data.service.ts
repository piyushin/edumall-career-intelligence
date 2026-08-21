import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AssessmentInterpretationSetStatus, Prisma, type PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { DATABASE_PRISMA } from "../database/database.tokens";
import {
  CAREER_FIT_VALIDATION_NOTICE,
  COUNSELOR_VALIDATION_NOTICE,
  EMPLOYMENT_DECISION_NOTICE,
  assessmentProductSegmentProfile,
  isEmploymentProductSegment,
  resolveAssessmentProductSegment,
} from "./assessment-product-segment";

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

function resolveIndiaLocale(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized.startsWith("hi")) return "hi-IN";
  if (normalized.startsWith("gu")) return "gu-IN";
  if (normalized.startsWith("mr")) return "mr-IN";
  return "en-IN";
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
                  description: true,
                  orderIndex: true,
                  metadata: true,
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
      const productSegment = resolveAssessmentProductSegment(
        version.assessmentDefinition.code,
        version.edition,
      );
      const segmentProfile = assessmentProductSegmentProfile(productSegment);

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

      const careerFitRun = await tx.careerFitRun.findFirst({
        where: { scoringRunId },
        orderBy: { calculatedAt: "desc" },
        select: {
          id: true,
          inputHash: true,
          algorithmKey: true,
          algorithmVersion: true,
          calculatedAt: true,
          metadata: true,
          careerFitModel: {
            select: {
              id: true,
              version: true,
              name: true,
              description: true,
              sourceReference: true,
              methodology: true,
              careerTaxonomyVersion: {
                select: {
                  id: true,
                  version: true,
                  edition: true,
                  locale: true,
                  sourceReference: true,
                  methodology: true,
                },
              },
            },
          },
          results: {
            orderBy: { rank: "asc" },
            select: {
              careerPathId: true,
              score: true,
              rank: true,
              evidenceData: true,
              careerPath: {
                select: {
                  code: true,
                  name: true,
                  description: true,
                  careerCluster: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      description: true,
                    },
                  },
                },
              },
              recommendationBand: {
                select: {
                  id: true,
                  code: true,
                  label: true,
                  outputData: true,
                },
              },
            },
          },
        },
      });

      const payload = {
        schemaVersion: "assessment-report-data-v3",
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
          productSegment,
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
            description: score.assessmentConstruct.description,
            metadata: score.assessmentConstruct.metadata,
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
        ...(careerFitRun
          ? {
              careerFit: {
                careerFitRunId: careerFitRun.id,
                inputHash: careerFitRun.inputHash,
                algorithmKey: careerFitRun.algorithmKey,
                algorithmVersion: careerFitRun.algorithmVersion,
                calculatedAt: careerFitRun.calculatedAt.toISOString(),
                metadata: careerFitRun.metadata,
                model: {
                  id: careerFitRun.careerFitModel.id,
                  version: careerFitRun.careerFitModel.version,
                  name: careerFitRun.careerFitModel.name,
                  description: careerFitRun.careerFitModel.description,
                  sourceReference: careerFitRun.careerFitModel.sourceReference,
                  methodology: careerFitRun.careerFitModel.methodology,
                },
                taxonomy: {
                  id: careerFitRun.careerFitModel.careerTaxonomyVersion.id,
                  version: careerFitRun.careerFitModel.careerTaxonomyVersion.version,
                  edition: careerFitRun.careerFitModel.careerTaxonomyVersion.edition,
                  locale: careerFitRun.careerFitModel.careerTaxonomyVersion.locale,
                  sourceReference:
                    careerFitRun.careerFitModel.careerTaxonomyVersion.sourceReference,
                  methodology: careerFitRun.careerFitModel.careerTaxonomyVersion.methodology,
                },
                rankedCareerPaths: careerFitRun.results.map((result) => ({
                  careerPathId: result.careerPathId,
                  careerPathCode: result.careerPath.code,
                  careerPathName: result.careerPath.name,
                  careerPathDescription: result.careerPath.description,
                  careerClusterId: result.careerPath.careerCluster.id,
                  careerClusterCode: result.careerPath.careerCluster.code,
                  careerClusterName: result.careerPath.careerCluster.name,
                  careerClusterDescription: result.careerPath.careerCluster.description,
                  score: result.score.toString(),
                  rank: result.rank,
                  recommendationBand: result.recommendationBand
                    ? {
                        id: result.recommendationBand.id,
                        code: result.recommendationBand.code,
                        label: result.recommendationBand.label,
                        outputData: result.recommendationBand.outputData,
                      }
                    : null,
                  evidence: result.evidenceData,
                })),
              },
            }
          : {}),
        reportComposition: {
          templateId: segmentProfile.templateId,
          templateVersion: "1",
          audience: "CANDIDATE",
          locale: resolveIndiaLocale(version.language),
          productSegment,
          reportNotice: COUNSELOR_VALIDATION_NOTICE,
          careerFitNotice: CAREER_FIT_VALIDATION_NOTICE,
          employmentDecisionNotice: isEmploymentProductSegment(productSegment)
            ? EMPLOYMENT_DECISION_NOTICE
            : null,
        },
        provenance: {
          snapshotPolicy: "immutable-v3",
          interpretationPolicy: "published-only",
          careerFitPolicy: careerFitRun ? "frozen-deterministic-run" : "not-available",
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
