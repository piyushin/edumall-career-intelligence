import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssessmentInterpretationMetric,
  AssessmentInterpretationSetStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { DATABASE_PRISMA } from "../database/database.tokens";

type NormApplicationForInterpretation = {
  id: string;
  assessmentConstructId: string;
  rawScore: Prisma.Decimal;
  standardizedScore: Prisma.Decimal | null;
  percentile: Prisma.Decimal | null;
};

@Injectable()
export class AssessmentInterpretationService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async applyPublishedInterpretationSet(
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
          attempt: {
            select: {
              assignment: {
                select: {
                  assessmentVersionId: true,
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

      const interpretationSet = await tx.assessmentInterpretationSet.findUnique({
        where: {
          id: interpretationSetId,
        },
        select: {
          id: true,
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
          message: "Only a published interpretation set may be applied.",
        });
      }

      if (
        interpretationSet.assessmentVersionId !== scoringRun.attempt.assignment.assessmentVersionId
      ) {
        throw new ConflictException({
          code: "ASSESSMENT_INTERPRETATION_VERSION_MISMATCH",
          message: "The interpretation set does not belong to the scoring run assessment version.",
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
          rawScore: true,
          standardizedScore: true,
          percentile: true,
        },
      });

      if (normApplications.length === 0) {
        throw new ConflictException({
          code: "ASSESSMENT_INTERPRETATION_NO_NORM_RESULTS",
          message: "No normalized construct results exist for the selected norm group.",
        });
      }

      for (const application of normApplications) {
        const rules = await tx.assessmentInterpretationRule.findMany({
          where: {
            interpretationSetId,
            assessmentConstructId: application.assessmentConstructId,
          },
          orderBy: [
            {
              priority: "desc",
            },
            {
              code: "asc",
            },
          ],
          select: {
            id: true,
            code: true,
            metric: true,
            lowerBound: true,
            upperBound: true,
            lowerInclusive: true,
            upperInclusive: true,
            priority: true,
            outputData: true,
          },
        });

        const matches = rules
          .map((rule) => ({
            rule,
            metricValue: this.metricValue(application, rule.metric),
          }))
          .filter(
            (
              candidate,
            ): candidate is {
              rule: (typeof rules)[number];
              metricValue: Prisma.Decimal;
            } =>
              candidate.metricValue !== null &&
              this.matchesBounds(
                candidate.metricValue,
                candidate.rule.lowerBound,
                candidate.rule.upperBound,
                candidate.rule.lowerInclusive,
                candidate.rule.upperInclusive,
              ),
          );

        if (matches.length === 0) {
          throw new ConflictException({
            code: "ASSESSMENT_INTERPRETATION_RULE_MISSING",
            message: "No published interpretation rule matches a normalized construct result.",
          });
        }

        const highestPriority = matches[0]?.rule.priority;

        const highestPriorityMatches = matches.filter(
          (candidate) => candidate.rule.priority === highestPriority,
        );

        if (highestPriorityMatches.length > 1) {
          throw new ConflictException({
            code: "ASSESSMENT_INTERPRETATION_RULE_AMBIGUOUS",
            message:
              "Multiple interpretation rules with the same priority match the same construct result.",
          });
        }

        const selected = highestPriorityMatches[0];

        if (!selected) {
          throw new ConflictException({
            code: "ASSESSMENT_INTERPRETATION_RULE_MISSING",
            message: "No published interpretation rule matches a normalized construct result.",
          });
        }

        const existing = await tx.assessmentInterpretationApplication.findUnique({
          where: {
            normApplicationId_interpretationRuleId: {
              normApplicationId: application.id,
              interpretationRuleId: selected.rule.id,
            },
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          continue;
        }

        await tx.assessmentInterpretationApplication.create({
          data: {
            normApplicationId: application.id,
            interpretationRuleId: selected.rule.id,
            metricValue: selected.metricValue,
            outputData: selected.rule.outputData ?? Prisma.JsonNull,
          },
        });
      }

      const applications = await tx.assessmentInterpretationApplication.findMany({
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
          appliedAt: "asc",
        },
        select: {
          id: true,
          normApplicationId: true,
          interpretationRuleId: true,
          metricValue: true,
          outputData: true,
          appliedAt: true,
        },
      });

      return applications.map((application) => ({
        ...application,
        metricValue: application.metricValue.toString(),
      }));
    });
  }

  private metricValue(
    application: NormApplicationForInterpretation,
    metric: AssessmentInterpretationMetric,
  ): Prisma.Decimal | null {
    if (metric === AssessmentInterpretationMetric.RAW_SCORE) {
      return application.rawScore;
    }

    if (metric === AssessmentInterpretationMetric.STANDARDIZED_SCORE) {
      return application.standardizedScore;
    }

    return application.percentile;
  }

  private matchesBounds(
    value: Prisma.Decimal,
    lowerBound: Prisma.Decimal | null,
    upperBound: Prisma.Decimal | null,
    lowerInclusive: boolean,
    upperInclusive: boolean,
  ): boolean {
    if (lowerBound !== null) {
      const comparison = value.comparedTo(lowerBound);

      if ((lowerInclusive && comparison < 0) || (!lowerInclusive && comparison <= 0)) {
        return false;
      }
    }

    if (upperBound !== null) {
      const comparison = value.comparedTo(upperBound);

      if ((upperInclusive && comparison > 0) || (!upperInclusive && comparison >= 0)) {
        return false;
      }
    }

    return true;
  }
}
