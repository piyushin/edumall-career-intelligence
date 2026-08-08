import { createHash } from "node:crypto";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { calculateConstructRawScores } from "@edumall/database";
import {
  AssessmentAttemptStatus,
  AssessmentItemType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { DATABASE_PRISMA } from "../database/database.tokens";

const SCORING_ALGORITHM_VERSION = "explicit-option-key-v1";

type CanonicalScoringRow = {
  constructId: string;
  itemId: string;
  optionId: string;
  score: string;
  weight: string;
};

@Injectable()
export class AssessmentScoringService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async scoreSubmittedAttempt(attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: {
        id: attemptId,
      },
      select: {
        id: true,
        status: true,
        assignment: {
          select: {
            assessmentVersion: {
              select: {
                scoringVersion: true,
              },
            },
          },
        },
        responses: {
          select: {
            itemId: true,
            item: {
              select: {
                type: true,
                constructLinks: {
                  select: {
                    assessmentConstructId: true,
                    weight: true,
                    reverseScored: true,
                  },
                },
              },
            },
            selections: {
              select: {
                optionId: true,
                option: {
                  select: {
                    scores: {
                      select: {
                        assessmentConstructId: true,
                        score: true,
                      },
                    },
                  },
                },
              },
            },
          },
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
        message: "Only submitted assessment attempts may be scored.",
      });
    }

    const canonicalRows = this.buildCanonicalScoringRows(attempt.responses);

    const inputHash = createHash("sha256")
      .update(JSON.stringify(canonicalRows), "utf8")
      .digest("hex");

    const scoringVersion = attempt.assignment.assessmentVersion.scoringVersion;

    const uniqueWhere = {
      attemptId_scoringVersion_algorithmVersion_inputHash: {
        attemptId,
        scoringVersion,
        algorithmVersion: SCORING_ALGORITHM_VERSION,
        inputHash,
      },
    };

    const existing = await this.prisma.assessmentScoringRun.findUnique({
      where: uniqueWhere,
      select: {
        id: true,
        attemptId: true,
        scoringVersion: true,
        algorithmVersion: true,
        inputHash: true,
        calculatedAt: true,
        constructScores: {
          orderBy: {
            assessmentConstructId: "asc",
          },
          select: {
            assessmentConstructId: true,
            rawScore: true,
            answeredItemCount: true,
            contributionCount: true,
          },
        },
      },
    });

    if (existing) {
      return this.serializeRun(existing);
    }

    const constructScores = calculateConstructRawScores(
      canonicalRows.map((row) => ({
        constructId: row.constructId,
        itemId: row.itemId,
        score: row.score,
        weight: row.weight,
      })),
    );

    try {
      const run = await this.prisma.$transaction(async (tx) => {
        const created = await tx.assessmentScoringRun.create({
          data: {
            attemptId,
            scoringVersion,
            algorithmVersion: SCORING_ALGORITHM_VERSION,
            inputHash,
          },
          select: {
            id: true,
          },
        });

        if (constructScores.length > 0) {
          await tx.assessmentConstructScore.createMany({
            data: constructScores.map((score) => ({
              scoringRunId: created.id,
              assessmentConstructId: score.constructId,
              rawScore: score.rawScore,
              answeredItemCount: score.answeredItemCount,
              contributionCount: score.contributionCount,
            })),
          });
        }

        return tx.assessmentScoringRun.findUniqueOrThrow({
          where: {
            id: created.id,
          },
          select: {
            id: true,
            attemptId: true,
            scoringVersion: true,
            algorithmVersion: true,
            inputHash: true,
            calculatedAt: true,
            constructScores: {
              orderBy: {
                assessmentConstructId: "asc",
              },
              select: {
                assessmentConstructId: true,
                rawScore: true,
                answeredItemCount: true,
                contributionCount: true,
              },
            },
          },
        });
      });

      return this.serializeRun(run);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await this.prisma.assessmentScoringRun.findUnique({
          where: uniqueWhere,
          select: {
            id: true,
            attemptId: true,
            scoringVersion: true,
            algorithmVersion: true,
            inputHash: true,
            calculatedAt: true,
            constructScores: {
              orderBy: {
                assessmentConstructId: "asc",
              },
              select: {
                assessmentConstructId: true,
                rawScore: true,
                answeredItemCount: true,
                contributionCount: true,
              },
            },
          },
        });

        if (concurrent) {
          return this.serializeRun(concurrent);
        }
      }

      throw error;
    }
  }

  private buildCanonicalScoringRows(
    responses: Array<{
      itemId: string;
      item: {
        type: AssessmentItemType;
        constructLinks: Array<{
          assessmentConstructId: string;
          weight: Prisma.Decimal;
          reverseScored: boolean;
        }>;
      };
      selections: Array<{
        optionId: string;
        option: {
          scores: Array<{
            assessmentConstructId: string;
            score: Prisma.Decimal;
          }>;
        };
      }>;
    }>,
  ): CanonicalScoringRow[] {
    const rows: CanonicalScoringRow[] = [];

    for (const response of responses) {
      const links = new Map(
        response.item.constructLinks.map((link) => [link.assessmentConstructId, link]),
      );

      const isOptionScored =
        response.item.type === AssessmentItemType.SINGLE_CHOICE ||
        response.item.type === AssessmentItemType.MULTIPLE_CHOICE ||
        response.item.type === AssessmentItemType.LIKERT;

      if (!isOptionScored && links.size > 0) {
        throw new ConflictException({
          code: "ASSESSMENT_SCORING_CONFIGURATION_UNSUPPORTED",
          message:
            "A scored assessment item uses a response type that does not yet have an explicit scoring strategy.",
        });
      }

      for (const selection of response.selections) {
        const scoredConstructs = new Set<string>();

        for (const score of selection.option.scores) {
          const link = links.get(score.assessmentConstructId);

          if (!link) {
            throw new ConflictException({
              code: "ASSESSMENT_SCORING_CONFIGURATION_INVALID",
              message:
                "An assessment option score does not have a matching item-to-construct link.",
            });
          }

          scoredConstructs.add(score.assessmentConstructId);

          rows.push({
            constructId: score.assessmentConstructId,
            itemId: response.itemId,
            optionId: selection.optionId,
            score: score.score.toString(),
            weight: link.weight.toString(),
          });
        }

        for (const constructId of links.keys()) {
          if (!scoredConstructs.has(constructId)) {
            throw new ConflictException({
              code: "ASSESSMENT_SCORING_CONFIGURATION_INCOMPLETE",
              message:
                "A selected response option is missing an explicit score for one or more linked constructs.",
            });
          }
        }
      }
    }

    rows.sort((left, right) => {
      const leftKey = [left.itemId, left.optionId, left.constructId, left.score, left.weight].join(
        "\u0000",
      );

      const rightKey = [
        right.itemId,
        right.optionId,
        right.constructId,
        right.score,
        right.weight,
      ].join("\u0000");

      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

    return rows;
  }

  private serializeRun(run: {
    id: string;
    attemptId: string;
    scoringVersion: string;
    algorithmVersion: string;
    inputHash: string;
    calculatedAt: Date;
    constructScores: Array<{
      assessmentConstructId: string;
      rawScore: Prisma.Decimal;
      answeredItemCount: number;
      contributionCount: number;
    }>;
  }) {
    return {
      id: run.id,
      attemptId: run.attemptId,
      scoringVersion: run.scoringVersion,
      algorithmVersion: run.algorithmVersion,
      inputHash: run.inputHash,
      calculatedAt: run.calculatedAt,
      constructScores: run.constructScores.map((score) => ({
        assessmentConstructId: score.assessmentConstructId,
        rawScore: score.rawScore.toString(),
        answeredItemCount: score.answeredItemCount,
        contributionCount: score.contributionCount,
      })),
    };
  }
}
