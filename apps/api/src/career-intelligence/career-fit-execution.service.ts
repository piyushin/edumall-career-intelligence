import { createHash } from "node:crypto";
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
  CareerFitModelStatus,
  CareerTaxonomyVersionStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { AssessmentNormService } from "../assessments/assessment-norm.service";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import {
  CareerFitAlgorithmExecutionError,
  CareerFitAlgorithmRegistry,
  type CareerFitAlgorithmExecutionInput,
  type CareerFitAlgorithmExecutionPath,
  type CareerFitAlgorithmExecutionResult,
} from "./career-fit-algorithm.registry";

const CAREER_FIT_RUN_SELECTION = {
  id: true,
  scoringRunId: true,
  careerFitModelId: true,
  inputHash: true,
  algorithmKey: true,
  algorithmVersion: true,
  calculatedAt: true,
  metadata: true,
  results: {
    orderBy: {
      rank: "asc" as const,
    },
    select: {
      careerPathId: true,
      score: true,
      rank: true,
      recommendationBandId: true,
      evidenceData: true,
      careerPath: {
        select: {
          code: true,
          name: true,
          careerCluster: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
      recommendationBand: {
        select: {
          code: true,
          label: true,
          outputData: true,
        },
      },
    },
  },
} satisfies Prisma.CareerFitRunSelect;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const serialized = JSON.stringify(value);

    if (serialized === undefined) {
      throw new Error("Career-fit input contains a non-serializable value.");
    }

    return serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();

  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
}

@Injectable()
export class CareerFitExecutionService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(AssessmentNormService)
    private readonly norms: AssessmentNormService,
    @Inject(CareerFitAlgorithmRegistry)
    private readonly algorithms: CareerFitAlgorithmRegistry,
  ) {}

  public async executeForAttempt(
    context: AuthContext,
    attemptId: string,
    normGroupId: string,
    careerFitModelId: string,
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
        assignment: {
          select: {
            assessmentVersionId: true,
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

    if (!scoringRun) {
      throw new ConflictException({
        code: "CAREER_FIT_SCORING_RUN_REQUIRED",
        message: "A deterministic scoring run is required before career fit can be calculated.",
      });
    }

    const model = await this.prisma.careerFitModel.findUnique({
      where: {
        id: careerFitModelId,
      },
      select: {
        id: true,
        assessmentVersionId: true,
        careerTaxonomyVersionId: true,
        version: true,
        algorithmKey: true,
        algorithmVersion: true,
        sourceReference: true,
        methodology: true,
        status: true,
        careerTaxonomyVersion: {
          select: {
            id: true,
            version: true,
            status: true,
          },
        },
        factors: {
          orderBy: {
            orderIndex: "asc",
          },
          select: {
            id: true,
            careerPathId: true,
            assessmentConstructId: true,
            weight: true,
            direction: true,
            configuration: true,
            sourceReference: true,
            orderIndex: true,
            careerPath: {
              select: {
                id: true,
                code: true,
                name: true,
                careerTaxonomyVersionId: true,
                careerCluster: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        recommendationBands: {
          orderBy: [{ priority: "desc" }, { code: "asc" }],
          select: {
            id: true,
            code: true,
            label: true,
            lowerBound: true,
            upperBound: true,
            lowerInclusive: true,
            upperInclusive: true,
            priority: true,
            outputData: true,
          },
        },
      },
    });

    if (!model) {
      throw new NotFoundException({
        code: "CAREER_FIT_MODEL_NOT_FOUND",
        message: "Career-fit model not found.",
      });
    }

    if (model.status !== CareerFitModelStatus.PUBLISHED) {
      throw new ConflictException({
        code: "CAREER_FIT_MODEL_NOT_PUBLISHED",
        message: "Only a published career-fit model may be executed.",
      });
    }

    if (model.careerTaxonomyVersion.status !== CareerTaxonomyVersionStatus.PUBLISHED) {
      throw new ConflictException({
        code: "CAREER_FIT_TAXONOMY_NOT_PUBLISHED",
        message: "The career-fit model references a taxonomy version that is not published.",
      });
    }

    if (model.assessmentVersionId !== attempt.assignment.assessmentVersionId) {
      throw new ConflictException({
        code: "CAREER_FIT_ASSESSMENT_VERSION_MISMATCH",
        message: "The career-fit model does not belong to the candidate assessment version.",
      });
    }

    const algorithm = this.algorithms.get(model.algorithmKey, model.algorithmVersion);

    if (!algorithm) {
      throw new ConflictException({
        code: "CAREER_FIT_ALGORITHM_NOT_REGISTERED",
        message:
          "The published career-fit model references an unavailable algorithm implementation.",
      });
    }

    if (model.factors.length === 0) {
      throw new ConflictException({
        code: "CAREER_FIT_MODEL_HAS_NO_FACTORS",
        message: "The published career-fit model does not contain any career mapping factors.",
      });
    }

    await this.norms.applyPublishedNormGroup(scoringRun.id, normGroupId);

    const [normGroup, normApplications] = await Promise.all([
      this.prisma.assessmentNormGroup.findUnique({
        where: {
          id: normGroupId,
        },
        select: {
          id: true,
          code: true,
          normSetId: true,
          normSet: {
            select: {
              id: true,
              normVersion: true,
              assessmentVersionId: true,
            },
          },
        },
      }),
      this.prisma.assessmentNormApplication.findMany({
        where: {
          scoringRunId: scoringRun.id,
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
      }),
    ]);

    if (!normGroup || normGroup.normSet.assessmentVersionId !== model.assessmentVersionId) {
      throw new ConflictException({
        code: "CAREER_FIT_NORM_GROUP_MISMATCH",
        message: "The norm group does not belong to the career-fit assessment version.",
      });
    }

    const normByConstruct = new Map(
      normApplications.map((application) => [application.assessmentConstructId, application]),
    );

    const careerPathMap = new Map<string, CareerFitAlgorithmExecutionPath>();

    for (const factor of model.factors) {
      if (factor.careerPath.careerTaxonomyVersionId !== model.careerTaxonomyVersionId) {
        throw new ConflictException({
          code: "CAREER_FIT_FACTOR_TAXONOMY_SCOPE_MISMATCH",
          message: "A model factor references a career path outside the model taxonomy version.",
        });
      }

      const norm = normByConstruct.get(factor.assessmentConstructId);

      if (!norm) {
        throw new ConflictException({
          code: "CAREER_FIT_NORM_DATA_INCOMPLETE",
          message: "Every career-fit factor requires normalized data for its assessment construct.",
        });
      }

      let path = careerPathMap.get(factor.careerPathId);

      if (!path) {
        path = {
          careerPathId: factor.careerPath.id,
          careerPathCode: factor.careerPath.code,
          careerPathName: factor.careerPath.name,
          careerClusterId: factor.careerPath.careerCluster.id,
          careerClusterCode: factor.careerPath.careerCluster.code,
          careerClusterName: factor.careerPath.careerCluster.name,
          factors: [],
        };
        careerPathMap.set(factor.careerPathId, path);
      }

      path.factors.push({
        factorId: factor.id,
        assessmentConstructId: factor.assessmentConstructId,
        weight: factor.weight.toString(),
        direction: factor.direction,
        configuration: factor.configuration,
        sourceReference: factor.sourceReference,
        metrics: {
          normApplicationId: norm.id,
          rawScore: norm.rawScore.toString(),
          standardizedScore: norm.standardizedScore?.toString() ?? null,
          percentile: norm.percentile?.toString() ?? null,
        },
      });
    }

    const careerPaths = [...careerPathMap.values()]
      .map((path) => ({
        ...path,
        factors: [...path.factors].sort((left, right) =>
          left.factorId.localeCompare(right.factorId),
        ),
      }))
      .sort((left, right) => {
        const codeOrder = left.careerPathCode.localeCompare(right.careerPathCode);
        return codeOrder !== 0 ? codeOrder : left.careerPathId.localeCompare(right.careerPathId);
      });

    const executionInput: CareerFitAlgorithmExecutionInput = {
      schemaVersion: "career-fit-execution-input-v1",
      scoring: {
        scoringRunId: scoringRun.id,
        scoringVersion: scoringRun.scoringVersion,
        scoringAlgorithmVersion: scoringRun.algorithmVersion,
        scoringInputHash: scoringRun.inputHash,
      },
      norms: {
        normGroupId: normGroup.id,
        normGroupCode: normGroup.code,
        normSetId: normGroup.normSet.id,
        normVersion: normGroup.normSet.normVersion,
      },
      model: {
        careerFitModelId: model.id,
        modelVersion: model.version,
        algorithmKey: model.algorithmKey,
        algorithmVersion: model.algorithmVersion,
      },
      taxonomy: {
        taxonomyVersionId: model.careerTaxonomyVersion.id,
        taxonomyVersion: model.careerTaxonomyVersion.version,
      },
      careerPaths,
    };

    const recommendationBands = model.recommendationBands.map((band) => ({
      id: band.id,
      code: band.code,
      label: band.label,
      lowerBound: band.lowerBound?.toString() ?? null,
      upperBound: band.upperBound?.toString() ?? null,
      lowerInclusive: band.lowerInclusive,
      upperInclusive: band.upperInclusive,
      priority: band.priority,
      outputData: band.outputData,
    }));

    const canonicalPayload = {
      executionInput,
      recommendationBands,
      modelProvenance: {
        sourceReference: model.sourceReference,
        methodology: model.methodology,
      },
    };

    const inputHash = createHash("sha256")
      .update(canonicalize(canonicalPayload), "utf8")
      .digest("hex");

    const uniqueWhere = {
      scoringRunId_careerFitModelId_inputHash: {
        scoringRunId: scoringRun.id,
        careerFitModelId: model.id,
        inputHash,
      },
    };

    const existing = await this.prisma.careerFitRun.findUnique({
      where: uniqueWhere,
      select: CAREER_FIT_RUN_SELECTION,
    });

    if (existing) {
      return this.serializeRun(existing);
    }

    let algorithmResults: CareerFitAlgorithmExecutionResult[];

    try {
      algorithmResults = algorithm.execute(executionInput);
    } catch (error) {
      if (error instanceof CareerFitAlgorithmExecutionError) {
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    const preparedResults = this.prepareResults(
      careerPaths,
      recommendationBands,
      algorithm.rankOrder,
      algorithmResults,
    );

    const metadata = {
      inputSchemaVersion: executionInput.schemaVersion,
      normGroupId: normGroup.id,
      normSetId: normGroup.normSet.id,
      normVersion: normGroup.normSet.normVersion,
      scoringInputHash: scoringRun.inputHash,
      taxonomyVersionId: model.careerTaxonomyVersion.id,
      taxonomyVersion: model.careerTaxonomyVersion.version,
    } satisfies Prisma.InputJsonObject;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const run = await tx.careerFitRun.create({
          data: {
            scoringRunId: scoringRun.id,
            careerFitModelId: model.id,
            inputHash,
            algorithmKey: model.algorithmKey,
            algorithmVersion: model.algorithmVersion,
            metadata,
          },
          select: {
            id: true,
          },
        });

        await tx.careerFitResult.createMany({
          data: preparedResults.map((result) => ({
            careerFitRunId: run.id,
            careerPathId: result.careerPathId,
            score: result.score,
            rank: result.rank,
            recommendationBandId: result.recommendationBandId,
            evidenceData: result.evidenceData as Prisma.InputJsonValue,
          })),
        });

        return tx.careerFitRun.findUniqueOrThrow({
          where: {
            id: run.id,
          },
          select: CAREER_FIT_RUN_SELECTION,
        });
      });

      return this.serializeRun(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await this.prisma.careerFitRun.findUnique({
          where: uniqueWhere,
          select: CAREER_FIT_RUN_SELECTION,
        });

        if (concurrent) {
          return this.serializeRun(concurrent);
        }
      }

      throw error;
    }
  }

  private prepareResults(
    careerPaths: CareerFitAlgorithmExecutionPath[],
    recommendationBands: Array<{
      id: string;
      code: string;
      label: string;
      lowerBound: string | null;
      upperBound: string | null;
      lowerInclusive: boolean;
      upperInclusive: boolean;
      priority: number;
      outputData: unknown;
    }>,
    rankOrder: "ASC" | "DESC",
    algorithmResults: CareerFitAlgorithmExecutionResult[],
  ) {
    const expectedPathIds = new Set(careerPaths.map((path) => path.careerPathId));
    const resultByPath = new Map<string, CareerFitAlgorithmExecutionResult>();

    for (const result of algorithmResults) {
      if (!expectedPathIds.has(result.careerPathId)) {
        throw new ConflictException({
          code: "CAREER_FIT_ALGORITHM_UNMAPPED_PATH",
          message: "The career-fit algorithm returned a path not mapped by the published model.",
        });
      }

      if (resultByPath.has(result.careerPathId)) {
        throw new ConflictException({
          code: "CAREER_FIT_ALGORITHM_DUPLICATE_PATH",
          message: "The career-fit algorithm returned more than one result for a career path.",
        });
      }

      this.assertEvidenceData(result.evidenceData);

      try {
        const score = new Prisma.Decimal(result.score);
        if (!score.isFinite()) throw new Error("non-finite score");
      } catch {
        throw new ConflictException({
          code: "CAREER_FIT_ALGORITHM_INVALID_SCORE",
          message: "The career-fit algorithm returned an invalid numeric score.",
        });
      }

      resultByPath.set(result.careerPathId, result);
    }

    if (resultByPath.size !== expectedPathIds.size) {
      throw new ConflictException({
        code: "CAREER_FIT_ALGORITHM_INCOMPLETE_OUTPUT",
        message:
          "The career-fit algorithm must return exactly one result for every mapped career path.",
      });
    }

    return careerPaths
      .map((path) => {
        const result = resultByPath.get(path.careerPathId);

        if (!result) {
          throw new ConflictException({
            code: "CAREER_FIT_ALGORITHM_INCOMPLETE_OUTPUT",
            message: "Career-fit output is incomplete.",
          });
        }

        const score = new Prisma.Decimal(result.score);
        const recommendationBand = recommendationBands.find((band) =>
          this.bandMatches(score, band),
        );

        return {
          careerPathId: path.careerPathId,
          careerPathCode: path.careerPathCode,
          score,
          recommendationBandId: recommendationBand?.id ?? null,
          evidenceData: result.evidenceData,
        };
      })
      .sort((left, right) => {
        const scoreOrder = left.score.comparedTo(right.score);

        if (scoreOrder !== 0) {
          return rankOrder === "DESC" ? -scoreOrder : scoreOrder;
        }

        const codeOrder = left.careerPathCode.localeCompare(right.careerPathCode);
        return codeOrder !== 0 ? codeOrder : left.careerPathId.localeCompare(right.careerPathId);
      })
      .map((result, index) => ({
        ...result,
        rank: index + 1,
      }));
  }

  private bandMatches(
    score: Prisma.Decimal,
    band: {
      lowerBound: string | null;
      upperBound: string | null;
      lowerInclusive: boolean;
      upperInclusive: boolean;
    },
  ): boolean {
    if (band.lowerBound !== null) {
      const comparison = score.comparedTo(new Prisma.Decimal(band.lowerBound));
      if (comparison < 0 || (comparison === 0 && !band.lowerInclusive)) return false;
    }

    if (band.upperBound !== null) {
      const comparison = score.comparedTo(new Prisma.Decimal(band.upperBound));
      if (comparison > 0 || (comparison === 0 && !band.upperInclusive)) return false;
    }

    return true;
  }

  private assertEvidenceData(value: Record<string, unknown>): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ConflictException({
        code: "CAREER_FIT_ALGORITHM_INVALID_EVIDENCE",
        message: "The career-fit algorithm must return evidence as a JSON object.",
      });
    }

    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error("not serializable");
      JSON.parse(serialized);
    } catch {
      throw new ConflictException({
        code: "CAREER_FIT_ALGORITHM_INVALID_EVIDENCE",
        message: "The career-fit algorithm returned non-serializable evidence data.",
      });
    }
  }

  private serializeRun(run: {
    id: string;
    scoringRunId: string;
    careerFitModelId: string;
    inputHash: string;
    algorithmKey: string;
    algorithmVersion: string;
    calculatedAt: Date;
    metadata: unknown;
    results: Array<{
      careerPathId: string;
      score: Prisma.Decimal;
      rank: number;
      recommendationBandId: string | null;
      evidenceData: unknown;
      careerPath: {
        code: string;
        name: string;
        careerCluster: {
          id: string;
          code: string;
          name: string;
        };
      };
      recommendationBand: {
        code: string;
        label: string;
        outputData: unknown;
      } | null;
    }>;
  }) {
    return {
      id: run.id,
      scoringRunId: run.scoringRunId,
      careerFitModelId: run.careerFitModelId,
      inputHash: run.inputHash,
      algorithmKey: run.algorithmKey,
      algorithmVersion: run.algorithmVersion,
      calculatedAt: run.calculatedAt,
      metadata: run.metadata,
      rankedCareerPaths: run.results.map((result) => ({
        careerPathId: result.careerPathId,
        careerPathCode: result.careerPath.code,
        careerPathName: result.careerPath.name,
        careerClusterId: result.careerPath.careerCluster.id,
        careerClusterCode: result.careerPath.careerCluster.code,
        careerClusterName: result.careerPath.careerCluster.name,
        score: result.score.toString(),
        rank: result.rank,
        recommendationBand: result.recommendationBand
          ? {
              id: result.recommendationBandId,
              code: result.recommendationBand.code,
              label: result.recommendationBand.label,
              outputData: result.recommendationBand.outputData,
            }
          : null,
        evidence: result.evidenceData,
      })),
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
          message: "You cannot calculate career fit for another organization.",
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
