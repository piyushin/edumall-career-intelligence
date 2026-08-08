import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AssessmentNormSetStatus, type PrismaClient } from "@prisma/client";
import { DATABASE_PRISMA } from "../database/database.tokens";

@Injectable()
export class AssessmentNormService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async applyPublishedNormGroup(scoringRunId: string, normGroupId: string) {
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
                  assessmentVersion: {
                    select: {
                      normVersion: true,
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

      if (scoringRun.constructScores.length === 0) {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_NO_RAW_SCORES",
          message: "The scoring run does not contain raw construct scores.",
        });
      }

      const assessmentVersionId = scoringRun.attempt.assignment.assessmentVersionId;

      const expectedNormVersion = scoringRun.attempt.assignment.assessmentVersion.normVersion;

      const normGroup = await tx.assessmentNormGroup.findUnique({
        where: {
          id: normGroupId,
        },
        select: {
          id: true,
          normSetId: true,
          normSet: {
            select: {
              assessmentVersionId: true,
              normVersion: true,
              status: true,
            },
          },
        },
      });

      if (!normGroup) {
        throw new NotFoundException({
          code: "ASSESSMENT_NORM_GROUP_NOT_FOUND",
          message: "Assessment norm group not found.",
        });
      }

      if (normGroup.normSet.status !== AssessmentNormSetStatus.PUBLISHED) {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_SET_NOT_PUBLISHED",
          message: "Only a published norm set may be applied.",
        });
      }

      if (
        normGroup.normSet.assessmentVersionId !== assessmentVersionId ||
        normGroup.normSet.normVersion !== expectedNormVersion
      ) {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_VERSION_MISMATCH",
          message: "The norm group does not belong to the scoring run assessment version.",
        });
      }

      for (const score of scoringRun.constructScores) {
        const existing = await tx.assessmentNormApplication.findUnique({
          where: {
            scoringRunId_assessmentConstructId_normGroupId: {
              scoringRunId,
              assessmentConstructId: score.assessmentConstructId,
              normGroupId,
            },
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          continue;
        }

        const table = await tx.assessmentConstructNormTable.findUnique({
          where: {
            normGroupId_assessmentConstructId: {
              normGroupId,
              assessmentConstructId: score.assessmentConstructId,
            },
          },
          select: {
            id: true,
          },
        });

        if (!table) {
          throw new ConflictException({
            code: "ASSESSMENT_NORM_TABLE_MISSING",
            message:
              "The selected norm group does not contain a norm table for every scored construct.",
          });
        }

        const rows = await tx.assessmentNormLookupRow.findMany({
          where: {
            constructNormTableId: table.id,
            rawScoreMin: {
              lte: score.rawScore,
            },
            rawScoreMax: {
              gte: score.rawScore,
            },
          },
          orderBy: [
            {
              rawScoreMin: "asc",
            },
            {
              rawScoreMax: "asc",
            },
          ],
          take: 2,
          select: {
            id: true,
            standardizedScore: true,
            percentile: true,
          },
        });

        if (rows.length === 0) {
          throw new ConflictException({
            code: "ASSESSMENT_NORM_LOOKUP_MISSING",
            message: "No norm lookup interval matches a scored construct.",
          });
        }

        if (rows.length > 1) {
          throw new ConflictException({
            code: "ASSESSMENT_NORM_LOOKUP_AMBIGUOUS",
            message: "Multiple norm lookup intervals match the same raw score.",
          });
        }

        const [row] = rows;

        if (!row) {
          throw new ConflictException({
            code: "ASSESSMENT_NORM_LOOKUP_MISSING",
            message: "No norm lookup interval matches a scored construct.",
          });
        }

        await tx.assessmentNormApplication.create({
          data: {
            scoringRunId,
            assessmentConstructId: score.assessmentConstructId,
            normSetId: normGroup.normSetId,
            normGroupId,
            constructNormTableId: table.id,
            normLookupRowId: row.id,
            rawScore: score.rawScore,
            standardizedScore: row.standardizedScore,
            percentile: row.percentile,
          },
        });
      }

      const applications = await tx.assessmentNormApplication.findMany({
        where: {
          scoringRunId,
          normGroupId,
        },
        orderBy: {
          assessmentConstructId: "asc",
        },
        select: {
          id: true,
          scoringRunId: true,
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

      return applications.map((application) => ({
        ...application,
        rawScore: application.rawScore.toString(),
        standardizedScore: application.standardizedScore?.toString() ?? null,
        percentile: application.percentile?.toString() ?? null,
      }));
    });
  }
}
