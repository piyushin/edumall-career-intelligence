import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentVersionStatus,
  CareerFitFactorDirection,
  CareerFitModelStatus,
  CareerTaxonomyStatus,
  CareerTaxonomyVersionStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { CareerFitAlgorithmRegistry } from "./career-fit-algorithm.registry";
import type {
  CreateCareerClusterDto,
  CreateCareerFitModelDto,
  CreateCareerFitModelFactorDto,
  CreateCareerFitRecommendationBandDto,
  CreateCareerPathDto,
  CreateCareerTaxonomyDto,
  CreateCareerTaxonomyVersionDto,
  UpdateCareerClusterDto,
  UpdateCareerFitModelDto,
  UpdateCareerFitModelFactorDto,
  UpdateCareerFitRecommendationBandDto,
  UpdateCareerPathDto,
  UpdateCareerTaxonomyDto,
  UpdateCareerTaxonomyVersionDto,
} from "./career-intelligence-admin.types";

export interface PublicationIssue {
  code: string;
  message: string;
  clusterId?: string;
  careerPathId?: string;
  factorId?: string;
  recommendationBandId?: string;
}

@Injectable()
export class CareerIntelligenceAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(CareerFitAlgorithmRegistry)
    private readonly algorithms: CareerFitAlgorithmRegistry,
  ) {}

  public listTaxonomies(context: AuthContext) {
    this.assertPlatformAdmin(context);

    return this.prisma.careerTaxonomy.findMany({
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            version: true,
            edition: true,
            locale: true,
            status: true,
            publishedAt: true,
            retiredAt: true,
          },
        },
      },
    });
  }

  public async createTaxonomy(context: AuthContext, body: CreateCareerTaxonomyDto) {
    this.assertPlatformAdmin(context);

    try {
      return await this.prisma.careerTaxonomy.create({
        data: {
          code: body.code.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          status: CareerTaxonomyStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_TAXONOMY_CODE_CONFLICT",
        "A career taxonomy with this code already exists.",
      );
    }
  }

  public async updateTaxonomy(
    context: AuthContext,
    taxonomyId: string,
    body: UpdateCareerTaxonomyDto,
  ) {
    this.assertPlatformAdmin(context);
    const taxonomy = await this.requireActiveTaxonomy(taxonomyId);

    return this.prisma.careerTaxonomy.update({
      where: { id: taxonomy.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  public async createTaxonomyVersion(
    context: AuthContext,
    taxonomyId: string,
    body: CreateCareerTaxonomyVersionDto,
  ) {
    this.assertPlatformAdmin(context);
    const taxonomy = await this.requireActiveTaxonomy(taxonomyId);

    try {
      return await this.prisma.careerTaxonomyVersion.create({
        data: {
          careerTaxonomyId: taxonomy.id,
          version: body.version.trim(),
          edition: body.edition.trim(),
          locale: body.locale.trim(),
          sourceReference: body.sourceReference?.trim() || null,
          ...(body.methodology !== undefined
            ? { methodology: body.methodology as Prisma.InputJsonValue }
            : {}),
          status: CareerTaxonomyVersionStatus.DRAFT,
        },
        select: {
          id: true,
          careerTaxonomyId: true,
          version: true,
          edition: true,
          locale: true,
          sourceReference: true,
          methodology: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_TAXONOMY_VERSION_CONFLICT",
        "This career taxonomy version already exists.",
      );
    }
  }

  public async getTaxonomyVersion(context: AuthContext, taxonomyId: string, versionId: string) {
    this.assertPlatformAdmin(context);

    const version = await this.prisma.careerTaxonomyVersion.findFirst({
      where: {
        id: versionId,
        careerTaxonomyId: taxonomyId,
      },
      select: {
        id: true,
        careerTaxonomyId: true,
        version: true,
        edition: true,
        locale: true,
        status: true,
        sourceReference: true,
        methodology: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        retiredAt: true,
        clusters: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            orderIndex: true,
            paths: {
              orderBy: { orderIndex: "asc" },
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                orderIndex: true,
              },
            },
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException({
        code: "CAREER_TAXONOMY_VERSION_NOT_FOUND",
        message: "Career taxonomy version not found.",
      });
    }

    return version;
  }

  public async updateTaxonomyVersion(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    body: UpdateCareerTaxonomyVersionDto,
  ) {
    const version = await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);

    return this.prisma.careerTaxonomyVersion.update({
      where: { id: version.id },
      data: {
        ...(body.edition !== undefined ? { edition: body.edition.trim() } : {}),
        ...(body.locale !== undefined ? { locale: body.locale.trim() } : {}),
        ...(body.sourceReference !== undefined
          ? { sourceReference: body.sourceReference.trim() || null }
          : {}),
        ...(body.methodology !== undefined
          ? { methodology: body.methodology as Prisma.InputJsonValue }
          : {}),
      },
      select: {
        id: true,
        careerTaxonomyId: true,
        version: true,
        edition: true,
        locale: true,
        status: true,
        sourceReference: true,
        methodology: true,
        updatedAt: true,
      },
    });
  }

  public async createCluster(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    body: CreateCareerClusterDto,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);

    try {
      return await this.prisma.careerCluster.create({
        data: {
          careerTaxonomyVersionId: versionId,
          code: body.code.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          orderIndex: body.orderIndex,
        },
        select: {
          id: true,
          careerTaxonomyVersionId: true,
          code: true,
          name: true,
          description: true,
          orderIndex: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_CLUSTER_CONFLICT",
        "A career cluster with this code or order already exists in the taxonomy version.",
      );
    }
  }

  public async updateCluster(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    clusterId: string,
    body: UpdateCareerClusterDto,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);
    const cluster = await this.requireCluster(versionId, clusterId);

    try {
      return await this.prisma.careerCluster.update({
        where: { id: cluster.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description.trim() || null }
            : {}),
          ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
        },
        select: {
          id: true,
          careerTaxonomyVersionId: true,
          code: true,
          name: true,
          description: true,
          orderIndex: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_CLUSTER_CONFLICT",
        "A career cluster with this order already exists in the taxonomy version.",
      );
    }
  }

  public async deleteCluster(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    clusterId: string,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);
    const cluster = await this.requireCluster(versionId, clusterId);

    try {
      return await this.prisma.careerCluster.delete({
        where: { id: cluster.id },
        select: { id: true },
      });
    } catch (error) {
      this.throwKnownReferenceConflict(
        error,
        "CAREER_CLUSTER_IN_USE",
        "Delete or move the career paths in this cluster before deleting it.",
      );
    }
  }

  public async createPath(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    body: CreateCareerPathDto,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);
    await this.requireCluster(versionId, body.careerClusterId);

    try {
      return await this.prisma.careerPath.create({
        data: {
          careerTaxonomyVersionId: versionId,
          careerClusterId: body.careerClusterId,
          code: body.code.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          orderIndex: body.orderIndex,
        },
        select: {
          id: true,
          careerTaxonomyVersionId: true,
          careerClusterId: true,
          code: true,
          name: true,
          description: true,
          orderIndex: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_PATH_CONFLICT",
        "A career path with this code or order already exists in the taxonomy version.",
      );
    }
  }

  public async updatePath(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    pathId: string,
    body: UpdateCareerPathDto,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);
    const path = await this.requirePath(versionId, pathId);

    if (body.careerClusterId !== undefined) {
      await this.requireCluster(versionId, body.careerClusterId);
    }

    try {
      return await this.prisma.careerPath.update({
        where: { id: path.id },
        data: {
          ...(body.careerClusterId !== undefined ? { careerClusterId: body.careerClusterId } : {}),
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description.trim() || null }
            : {}),
          ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
        },
        select: {
          id: true,
          careerTaxonomyVersionId: true,
          careerClusterId: true,
          code: true,
          name: true,
          description: true,
          orderIndex: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_PATH_CONFLICT",
        "A career path with this order already exists in the taxonomy version.",
      );
    }
  }

  public async deletePath(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    pathId: string,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);
    const path = await this.requirePath(versionId, pathId);

    try {
      return await this.prisma.careerPath.delete({
        where: { id: path.id },
        select: { id: true },
      });
    } catch (error) {
      this.throwKnownReferenceConflict(
        error,
        "CAREER_PATH_IN_USE",
        "Remove career-fit factors that reference this career path before deleting it.",
      );
    }
  }

  public async getTaxonomyPublicationReadiness(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
  ) {
    await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId);
    return this.getTaxonomyPublicationReadinessWithClient(this.prisma, versionId);
  }

  public async publishTaxonomyVersion(context: AuthContext, taxonomyId: string, versionId: string) {
    this.assertPlatformAdmin(context);

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await this.requireDraftTaxonomyVersion(context, taxonomyId, versionId, transaction);
          const readiness = await this.getTaxonomyPublicationReadinessWithClient(
            transaction,
            versionId,
          );

          if (!readiness.ready) {
            throw new ConflictException({
              code: "CAREER_TAXONOMY_VERSION_NOT_READY_FOR_PUBLICATION",
              message: "Career taxonomy version failed publication readiness checks.",
              issues: readiness.issues,
            });
          }

          const publishedAt = new Date();
          const published = await transaction.careerTaxonomyVersion.update({
            where: { id: versionId },
            data: {
              status: CareerTaxonomyVersionStatus.PUBLISHED,
              publishedAt,
            },
            select: {
              id: true,
              careerTaxonomyId: true,
              version: true,
              status: true,
              publishedAt: true,
              retiredAt: true,
            },
          });

          await this.createAuditLog(transaction, context, {
            action: "CAREER_TAXONOMY_VERSION_PUBLISHED",
            entityType: "CareerTaxonomyVersion",
            entityId: versionId,
            metadata: {
              careerTaxonomyId: taxonomyId,
              version: published.version,
            },
          });

          return published;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwPublicationConcurrencyConflict(
        error,
        "CAREER_TAXONOMY_PUBLICATION_CONCURRENCY_CONFLICT",
        "The career taxonomy changed while publication was being finalized. Review readiness and try again.",
      );
    }
  }

  public async retireTaxonomyVersion(context: AuthContext, taxonomyId: string, versionId: string) {
    this.assertPlatformAdmin(context);

    return this.prisma.$transaction(async (transaction) => {
      const version = await transaction.careerTaxonomyVersion.findFirst({
        where: { id: versionId, careerTaxonomyId: taxonomyId },
        select: { id: true, version: true, status: true },
      });

      if (!version) {
        throw new NotFoundException({
          code: "CAREER_TAXONOMY_VERSION_NOT_FOUND",
          message: "Career taxonomy version not found.",
        });
      }

      if (version.status !== CareerTaxonomyVersionStatus.PUBLISHED) {
        throw new ConflictException({
          code: "CAREER_TAXONOMY_VERSION_NOT_PUBLISHED",
          message: "Only a published career taxonomy version may be retired.",
        });
      }

      const retired = await transaction.careerTaxonomyVersion.update({
        where: { id: version.id },
        data: {
          status: CareerTaxonomyVersionStatus.RETIRED,
          retiredAt: new Date(),
        },
        select: {
          id: true,
          careerTaxonomyId: true,
          version: true,
          status: true,
          publishedAt: true,
          retiredAt: true,
        },
      });

      await this.createAuditLog(transaction, context, {
        action: "CAREER_TAXONOMY_VERSION_RETIRED",
        entityType: "CareerTaxonomyVersion",
        entityId: version.id,
        metadata: {
          careerTaxonomyId: taxonomyId,
          version: version.version,
        },
      });

      return retired;
    });
  }

  public listFitModels(context: AuthContext) {
    this.assertPlatformAdmin(context);

    return this.prisma.careerFitModel.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        assessmentVersionId: true,
        careerTaxonomyVersionId: true,
        version: true,
        name: true,
        algorithmKey: true,
        algorithmVersion: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        retiredAt: true,
      },
    });
  }

  public async createFitModel(context: AuthContext, body: CreateCareerFitModelDto) {
    this.assertPlatformAdmin(context);

    const [assessmentVersion, taxonomyVersion] = await Promise.all([
      this.prisma.assessmentVersion.findUnique({
        where: { id: body.assessmentVersionId },
        select: { id: true },
      }),
      this.prisma.careerTaxonomyVersion.findUnique({
        where: { id: body.careerTaxonomyVersionId },
        select: { id: true },
      }),
    ]);

    if (!assessmentVersion) {
      throw new NotFoundException({
        code: "CAREER_FIT_ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version for the career-fit model was not found.",
      });
    }

    if (!taxonomyVersion) {
      throw new NotFoundException({
        code: "CAREER_FIT_TAXONOMY_VERSION_NOT_FOUND",
        message: "Career taxonomy version for the career-fit model was not found.",
      });
    }

    try {
      return await this.prisma.careerFitModel.create({
        data: {
          assessmentVersionId: assessmentVersion.id,
          careerTaxonomyVersionId: taxonomyVersion.id,
          version: body.version.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          algorithmKey: body.algorithmKey.trim(),
          algorithmVersion: body.algorithmVersion.trim(),
          sourceReference: body.sourceReference?.trim() || null,
          ...(body.methodology !== undefined
            ? { methodology: body.methodology as Prisma.InputJsonValue }
            : {}),
          status: CareerFitModelStatus.DRAFT,
        },
        select: {
          id: true,
          assessmentVersionId: true,
          careerTaxonomyVersionId: true,
          version: true,
          name: true,
          description: true,
          algorithmKey: true,
          algorithmVersion: true,
          sourceReference: true,
          methodology: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_FIT_MODEL_CONFLICT",
        "This career-fit model version already exists for the selected assessment and taxonomy versions.",
      );
    }
  }

  public async getFitModel(context: AuthContext, modelId: string) {
    this.assertPlatformAdmin(context);

    const model = await this.prisma.careerFitModel.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        assessmentVersionId: true,
        careerTaxonomyVersionId: true,
        version: true,
        name: true,
        description: true,
        algorithmKey: true,
        algorithmVersion: true,
        sourceReference: true,
        methodology: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        retiredAt: true,
        factors: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            careerPathId: true,
            assessmentConstructId: true,
            weight: true,
            direction: true,
            configuration: true,
            rationale: true,
            sourceReference: true,
            orderIndex: true,
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

    return model;
  }

  public async updateFitModel(
    context: AuthContext,
    modelId: string,
    body: UpdateCareerFitModelDto,
  ) {
    const model = await this.requireDraftFitModel(context, modelId);

    return this.prisma.careerFitModel.update({
      where: { id: model.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
        ...(body.algorithmKey !== undefined ? { algorithmKey: body.algorithmKey.trim() } : {}),
        ...(body.algorithmVersion !== undefined
          ? { algorithmVersion: body.algorithmVersion.trim() }
          : {}),
        ...(body.sourceReference !== undefined
          ? { sourceReference: body.sourceReference.trim() || null }
          : {}),
        ...(body.methodology !== undefined
          ? { methodology: body.methodology as Prisma.InputJsonValue }
          : {}),
      },
      select: {
        id: true,
        assessmentVersionId: true,
        careerTaxonomyVersionId: true,
        version: true,
        name: true,
        description: true,
        algorithmKey: true,
        algorithmVersion: true,
        sourceReference: true,
        methodology: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  public async createFitFactor(
    context: AuthContext,
    modelId: string,
    body: CreateCareerFitModelFactorDto,
  ) {
    const model = await this.requireDraftFitModel(context, modelId);
    await this.assertFactorScope(model, body.careerPathId, body.assessmentConstructId);

    try {
      return await this.prisma.careerFitModelFactor.create({
        data: {
          careerFitModelId: model.id,
          careerPathId: body.careerPathId,
          assessmentConstructId: body.assessmentConstructId,
          weight: body.weight,
          direction: body.direction ?? CareerFitFactorDirection.POSITIVE,
          ...(body.configuration !== undefined
            ? { configuration: body.configuration as Prisma.InputJsonValue }
            : {}),
          rationale: body.rationale?.trim() || null,
          sourceReference: body.sourceReference?.trim() || null,
          orderIndex: body.orderIndex,
        },
        select: {
          id: true,
          careerFitModelId: true,
          careerPathId: true,
          assessmentConstructId: true,
          weight: true,
          direction: true,
          configuration: true,
          rationale: true,
          sourceReference: true,
          orderIndex: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_FIT_FACTOR_CONFLICT",
        "This construct-to-career factor or factor order already exists in the model.",
      );
    }
  }

  public async updateFitFactor(
    context: AuthContext,
    modelId: string,
    factorId: string,
    body: UpdateCareerFitModelFactorDto,
  ) {
    const model = await this.requireDraftFitModel(context, modelId);
    const factor = await this.requireFactor(model.id, factorId);

    try {
      return await this.prisma.careerFitModelFactor.update({
        where: { id: factor.id },
        data: {
          ...(body.weight !== undefined ? { weight: body.weight } : {}),
          ...(body.direction !== undefined ? { direction: body.direction } : {}),
          ...(body.orderIndex !== undefined ? { orderIndex: body.orderIndex } : {}),
          ...(body.configuration !== undefined
            ? { configuration: body.configuration as Prisma.InputJsonValue }
            : {}),
          ...(body.rationale !== undefined ? { rationale: body.rationale.trim() || null } : {}),
          ...(body.sourceReference !== undefined
            ? { sourceReference: body.sourceReference.trim() || null }
            : {}),
        },
        select: {
          id: true,
          careerFitModelId: true,
          careerPathId: true,
          assessmentConstructId: true,
          weight: true,
          direction: true,
          configuration: true,
          rationale: true,
          sourceReference: true,
          orderIndex: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_FIT_FACTOR_CONFLICT",
        "This factor order already exists in the model.",
      );
    }
  }

  public async deleteFitFactor(context: AuthContext, modelId: string, factorId: string) {
    const model = await this.requireDraftFitModel(context, modelId);
    const factor = await this.requireFactor(model.id, factorId);

    return this.prisma.careerFitModelFactor.delete({
      where: { id: factor.id },
      select: { id: true },
    });
  }

  public async createRecommendationBand(
    context: AuthContext,
    modelId: string,
    body: CreateCareerFitRecommendationBandDto,
  ) {
    const model = await this.requireDraftFitModel(context, modelId);

    try {
      return await this.prisma.careerFitRecommendationBand.create({
        data: {
          careerFitModelId: model.id,
          code: body.code.trim(),
          label: body.label.trim(),
          ...(body.lowerBound !== undefined ? { lowerBound: body.lowerBound } : {}),
          ...(body.upperBound !== undefined ? { upperBound: body.upperBound } : {}),
          lowerInclusive: body.lowerInclusive ?? true,
          upperInclusive: body.upperInclusive ?? true,
          priority: body.priority ?? 0,
          ...(body.outputData !== undefined
            ? { outputData: body.outputData as Prisma.InputJsonValue }
            : {}),
        },
        select: {
          id: true,
          careerFitModelId: true,
          code: true,
          label: true,
          lowerBound: true,
          upperBound: true,
          lowerInclusive: true,
          upperInclusive: true,
          priority: true,
          outputData: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.throwKnownConflict(
        error,
        "CAREER_FIT_RECOMMENDATION_BAND_CONFLICT",
        "A recommendation band with this code already exists in the model.",
      );
    }
  }

  public async updateRecommendationBand(
    context: AuthContext,
    modelId: string,
    bandId: string,
    body: UpdateCareerFitRecommendationBandDto,
  ) {
    const model = await this.requireDraftFitModel(context, modelId);
    const band = await this.requireRecommendationBand(model.id, bandId);

    return this.prisma.careerFitRecommendationBand.update({
      where: { id: band.id },
      data: {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        ...(body.lowerBound !== undefined ? { lowerBound: body.lowerBound } : {}),
        ...(body.upperBound !== undefined ? { upperBound: body.upperBound } : {}),
        ...(body.lowerInclusive !== undefined ? { lowerInclusive: body.lowerInclusive } : {}),
        ...(body.upperInclusive !== undefined ? { upperInclusive: body.upperInclusive } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.outputData !== undefined
          ? { outputData: body.outputData as Prisma.InputJsonValue }
          : {}),
      },
      select: {
        id: true,
        careerFitModelId: true,
        code: true,
        label: true,
        lowerBound: true,
        upperBound: true,
        lowerInclusive: true,
        upperInclusive: true,
        priority: true,
        outputData: true,
        updatedAt: true,
      },
    });
  }

  public async deleteRecommendationBand(context: AuthContext, modelId: string, bandId: string) {
    const model = await this.requireDraftFitModel(context, modelId);
    const band = await this.requireRecommendationBand(model.id, bandId);

    return this.prisma.careerFitRecommendationBand.delete({
      where: { id: band.id },
      select: { id: true },
    });
  }

  public async getFitModelPublicationReadiness(context: AuthContext, modelId: string) {
    await this.requireDraftFitModel(context, modelId);
    return this.getFitModelPublicationReadinessWithClient(this.prisma, modelId);
  }

  public async publishFitModel(context: AuthContext, modelId: string) {
    this.assertPlatformAdmin(context);

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await this.requireDraftFitModel(context, modelId, transaction);
          const readiness = await this.getFitModelPublicationReadinessWithClient(
            transaction,
            modelId,
          );

          if (!readiness.ready) {
            throw new ConflictException({
              code: "CAREER_FIT_MODEL_NOT_READY_FOR_PUBLICATION",
              message: "Career-fit model failed publication readiness checks.",
              issues: readiness.issues,
            });
          }

          const publishedAt = new Date();
          const published = await transaction.careerFitModel.update({
            where: { id: modelId },
            data: {
              status: CareerFitModelStatus.PUBLISHED,
              publishedAt,
            },
            select: {
              id: true,
              assessmentVersionId: true,
              careerTaxonomyVersionId: true,
              version: true,
              algorithmKey: true,
              algorithmVersion: true,
              status: true,
              publishedAt: true,
              retiredAt: true,
            },
          });

          await this.createAuditLog(transaction, context, {
            action: "CAREER_FIT_MODEL_PUBLISHED",
            entityType: "CareerFitModel",
            entityId: modelId,
            metadata: {
              assessmentVersionId: published.assessmentVersionId,
              careerTaxonomyVersionId: published.careerTaxonomyVersionId,
              version: published.version,
              algorithmKey: published.algorithmKey,
              algorithmVersion: published.algorithmVersion,
            },
          });

          return published;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwPublicationConcurrencyConflict(
        error,
        "CAREER_FIT_PUBLICATION_CONCURRENCY_CONFLICT",
        "The career-fit model changed while publication was being finalized. Review readiness and try again.",
      );
    }
  }

  public async retireFitModel(context: AuthContext, modelId: string) {
    this.assertPlatformAdmin(context);

    return this.prisma.$transaction(async (transaction) => {
      const model = await transaction.careerFitModel.findUnique({
        where: { id: modelId },
        select: {
          id: true,
          version: true,
          status: true,
          assessmentVersionId: true,
          careerTaxonomyVersionId: true,
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
          message: "Only a published career-fit model may be retired.",
        });
      }

      const retired = await transaction.careerFitModel.update({
        where: { id: model.id },
        data: {
          status: CareerFitModelStatus.RETIRED,
          retiredAt: new Date(),
        },
        select: {
          id: true,
          version: true,
          status: true,
          publishedAt: true,
          retiredAt: true,
        },
      });

      await this.createAuditLog(transaction, context, {
        action: "CAREER_FIT_MODEL_RETIRED",
        entityType: "CareerFitModel",
        entityId: model.id,
        metadata: {
          assessmentVersionId: model.assessmentVersionId,
          careerTaxonomyVersionId: model.careerTaxonomyVersionId,
          version: model.version,
        },
      });

      return retired;
    });
  }

  private async getTaxonomyPublicationReadinessWithClient(
    client: Prisma.TransactionClient | PrismaClient,
    versionId: string,
  ) {
    const version = await client.careerTaxonomyVersion.findUniqueOrThrow({
      where: { id: versionId },
      select: {
        id: true,
        status: true,
        sourceReference: true,
        methodology: true,
        careerTaxonomy: {
          select: { status: true },
        },
        clusters: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            code: true,
            paths: {
              select: { id: true },
            },
          },
        },
      },
    });

    const issues: PublicationIssue[] = [];

    if (version.careerTaxonomy.status !== CareerTaxonomyStatus.ACTIVE) {
      issues.push({
        code: "CAREER_TAXONOMY_NOT_ACTIVE",
        message: "An archived career taxonomy cannot publish a new version.",
      });
    }

    if (!version.sourceReference?.trim()) {
      issues.push({
        code: "CAREER_TAXONOMY_SOURCE_REFERENCE_REQUIRED",
        message: "A published taxonomy version must document its source reference.",
      });
    }

    if (!version.methodology) {
      issues.push({
        code: "CAREER_TAXONOMY_METHODOLOGY_REQUIRED",
        message: "A published taxonomy version must document its methodology.",
      });
    }

    if (version.clusters.length === 0) {
      issues.push({
        code: "CAREER_TAXONOMY_HAS_NO_CLUSTERS",
        message: "The taxonomy version must contain at least one career cluster.",
      });
    }

    let pathCount = 0;
    for (const cluster of version.clusters) {
      pathCount += cluster.paths.length;
      if (cluster.paths.length === 0) {
        issues.push({
          code: "CAREER_CLUSTER_HAS_NO_PATHS",
          message: "Every published career cluster must contain at least one career path.",
          clusterId: cluster.id,
        });
      }
    }

    if (pathCount === 0) {
      issues.push({
        code: "CAREER_TAXONOMY_HAS_NO_PATHS",
        message: "The taxonomy version must contain at least one career path.",
      });
    }

    return {
      versionId: version.id,
      ready: issues.length === 0,
      clusterCount: version.clusters.length,
      pathCount,
      issues,
    };
  }

  private async getFitModelPublicationReadinessWithClient(
    client: Prisma.TransactionClient | PrismaClient,
    modelId: string,
  ) {
    const model = await client.careerFitModel.findUniqueOrThrow({
      where: { id: modelId },
      select: {
        id: true,
        status: true,
        algorithmKey: true,
        algorithmVersion: true,
        sourceReference: true,
        methodology: true,
        assessmentVersionId: true,
        careerTaxonomyVersionId: true,
        assessmentVersion: {
          select: { status: true },
        },
        careerTaxonomyVersion: {
          select: { status: true },
        },
        factors: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            careerPathId: true,
            assessmentConstructId: true,
            weight: true,
            direction: true,
            configuration: true,
            rationale: true,
            sourceReference: true,
            careerPath: {
              select: { careerTaxonomyVersionId: true },
            },
            assessmentConstruct: {
              select: { assessmentVersionId: true },
            },
          },
        },
        recommendationBands: {
          orderBy: [{ priority: "desc" }, { code: "asc" }],
          select: {
            id: true,
            code: true,
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

    const issues: PublicationIssue[] = [];

    if (model.assessmentVersion.status !== AssessmentVersionStatus.PUBLISHED) {
      issues.push({
        code: "CAREER_FIT_ASSESSMENT_VERSION_NOT_PUBLISHED",
        message: "Career-fit models may reference only a published assessment version.",
      });
    }

    if (model.careerTaxonomyVersion.status !== CareerTaxonomyVersionStatus.PUBLISHED) {
      issues.push({
        code: "CAREER_FIT_TAXONOMY_VERSION_NOT_PUBLISHED",
        message: "Career-fit models may reference only a published taxonomy version.",
      });
    }

    if (!model.sourceReference?.trim()) {
      issues.push({
        code: "CAREER_FIT_SOURCE_REFERENCE_REQUIRED",
        message: "A published career-fit model must document its scientific source reference.",
      });
    }

    if (!model.methodology) {
      issues.push({
        code: "CAREER_FIT_METHODOLOGY_REQUIRED",
        message: "A published career-fit model must document its methodology.",
      });
    }

    if (model.factors.length === 0) {
      issues.push({
        code: "CAREER_FIT_MODEL_HAS_NO_FACTORS",
        message:
          "A career-fit model must contain at least one approved construct-to-career factor.",
      });
    }

    for (const factor of model.factors) {
      if (factor.assessmentConstruct.assessmentVersionId !== model.assessmentVersionId) {
        issues.push({
          code: "CAREER_FIT_FACTOR_ASSESSMENT_SCOPE_MISMATCH",
          message:
            "A career-fit factor references a construct outside the model assessment version.",
          factorId: factor.id,
        });
      }

      if (factor.careerPath.careerTaxonomyVersionId !== model.careerTaxonomyVersionId) {
        issues.push({
          code: "CAREER_FIT_FACTOR_TAXONOMY_SCOPE_MISMATCH",
          message:
            "A career-fit factor references a career path outside the model taxonomy version.",
          factorId: factor.id,
        });
      }

      if (!factor.rationale?.trim()) {
        issues.push({
          code: "CAREER_FIT_FACTOR_RATIONALE_REQUIRED",
          message: "Every published construct-to-career factor must document its rationale.",
          factorId: factor.id,
        });
      }

      if (!factor.sourceReference?.trim()) {
        issues.push({
          code: "CAREER_FIT_FACTOR_SOURCE_REFERENCE_REQUIRED",
          message: "Every published construct-to-career factor must document its source reference.",
          factorId: factor.id,
        });
      }
    }

    const algorithm = this.algorithms.get(model.algorithmKey, model.algorithmVersion);

    if (!algorithm) {
      issues.push({
        code: "CAREER_FIT_ALGORITHM_NOT_REGISTERED",
        message:
          "The configured career-fit algorithm and version are not registered by the application.",
      });
    } else if (algorithm.validateConfiguration) {
      issues.push(
        ...algorithm.validateConfiguration({
          factors: model.factors.map((factor) => ({
            id: factor.id,
            careerPathId: factor.careerPathId,
            assessmentConstructId: factor.assessmentConstructId,
            weight: factor.weight.toString(),
            direction: factor.direction,
            configuration: factor.configuration,
          })),
          recommendationBands: model.recommendationBands.map((band) => ({
            id: band.id,
            code: band.code,
            lowerBound: band.lowerBound?.toString() ?? null,
            upperBound: band.upperBound?.toString() ?? null,
            lowerInclusive: band.lowerInclusive,
            upperInclusive: band.upperInclusive,
            priority: band.priority,
            outputData: band.outputData,
          })),
        }),
      );
    }

    issues.push(...this.findBandOverlapIssues(model.recommendationBands));

    return {
      modelId: model.id,
      ready: issues.length === 0,
      factorCount: model.factors.length,
      recommendationBandCount: model.recommendationBands.length,
      algorithmRegistered: algorithm !== null,
      issues,
    };
  }

  private async requireActiveTaxonomy(taxonomyId: string) {
    const taxonomy = await this.prisma.careerTaxonomy.findUnique({
      where: { id: taxonomyId },
      select: { id: true, status: true },
    });

    if (!taxonomy) {
      throw new NotFoundException({
        code: "CAREER_TAXONOMY_NOT_FOUND",
        message: "Career taxonomy not found.",
      });
    }

    if (taxonomy.status !== CareerTaxonomyStatus.ACTIVE) {
      throw new ConflictException({
        code: "CAREER_TAXONOMY_NOT_ACTIVE",
        message: "Only an active career taxonomy may be modified.",
      });
    }

    return taxonomy;
  }

  private async requireDraftTaxonomyVersion(
    context: AuthContext,
    taxonomyId: string,
    versionId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    this.assertPlatformAdmin(context);

    const version = await client.careerTaxonomyVersion.findFirst({
      where: {
        id: versionId,
        careerTaxonomyId: taxonomyId,
      },
      select: {
        id: true,
        careerTaxonomyId: true,
        status: true,
      },
    });

    if (!version) {
      throw new NotFoundException({
        code: "CAREER_TAXONOMY_VERSION_NOT_FOUND",
        message: "Career taxonomy version not found.",
      });
    }

    if (version.status !== CareerTaxonomyVersionStatus.DRAFT) {
      throw new ConflictException({
        code: "CAREER_TAXONOMY_VERSION_NOT_DRAFT",
        message: "Only draft career taxonomy versions may be modified.",
      });
    }

    return version;
  }

  private async requireCluster(versionId: string, clusterId: string) {
    const cluster = await this.prisma.careerCluster.findFirst({
      where: {
        id: clusterId,
        careerTaxonomyVersionId: versionId,
      },
      select: { id: true },
    });

    if (!cluster) {
      throw new NotFoundException({
        code: "CAREER_CLUSTER_NOT_FOUND",
        message: "Career cluster not found in this taxonomy version.",
      });
    }

    return cluster;
  }

  private async requirePath(versionId: string, pathId: string) {
    const path = await this.prisma.careerPath.findFirst({
      where: {
        id: pathId,
        careerTaxonomyVersionId: versionId,
      },
      select: { id: true },
    });

    if (!path) {
      throw new NotFoundException({
        code: "CAREER_PATH_NOT_FOUND",
        message: "Career path not found in this taxonomy version.",
      });
    }

    return path;
  }

  private async requireDraftFitModel(
    context: AuthContext,
    modelId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    this.assertPlatformAdmin(context);

    const model = await client.careerFitModel.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        status: true,
        assessmentVersionId: true,
        careerTaxonomyVersionId: true,
      },
    });

    if (!model) {
      throw new NotFoundException({
        code: "CAREER_FIT_MODEL_NOT_FOUND",
        message: "Career-fit model not found.",
      });
    }

    if (model.status !== CareerFitModelStatus.DRAFT) {
      throw new ConflictException({
        code: "CAREER_FIT_MODEL_NOT_DRAFT",
        message: "Only draft career-fit models may be modified.",
      });
    }

    return model;
  }

  private async assertFactorScope(
    model: {
      assessmentVersionId: string;
      careerTaxonomyVersionId: string;
    },
    careerPathId: string,
    assessmentConstructId: string,
  ) {
    const [path, construct] = await Promise.all([
      this.prisma.careerPath.findUnique({
        where: { id: careerPathId },
        select: { id: true, careerTaxonomyVersionId: true },
      }),
      this.prisma.assessmentConstruct.findUnique({
        where: { id: assessmentConstructId },
        select: { id: true, assessmentVersionId: true },
      }),
    ]);

    if (!path) {
      throw new NotFoundException({
        code: "CAREER_PATH_NOT_FOUND",
        message: "Career path for the career-fit factor was not found.",
      });
    }

    if (!construct) {
      throw new NotFoundException({
        code: "ASSESSMENT_CONSTRUCT_NOT_FOUND",
        message: "Assessment construct for the career-fit factor was not found.",
      });
    }

    if (path.careerTaxonomyVersionId !== model.careerTaxonomyVersionId) {
      throw new ConflictException({
        code: "CAREER_FIT_FACTOR_TAXONOMY_SCOPE_MISMATCH",
        message: "The career path is outside the career-fit model taxonomy version.",
      });
    }

    if (construct.assessmentVersionId !== model.assessmentVersionId) {
      throw new ConflictException({
        code: "CAREER_FIT_FACTOR_ASSESSMENT_SCOPE_MISMATCH",
        message: "The assessment construct is outside the career-fit model assessment version.",
      });
    }
  }

  private async requireFactor(modelId: string, factorId: string) {
    const factor = await this.prisma.careerFitModelFactor.findFirst({
      where: { id: factorId, careerFitModelId: modelId },
      select: { id: true },
    });

    if (!factor) {
      throw new NotFoundException({
        code: "CAREER_FIT_FACTOR_NOT_FOUND",
        message: "Career-fit model factor not found.",
      });
    }

    return factor;
  }

  private async requireRecommendationBand(modelId: string, bandId: string) {
    const band = await this.prisma.careerFitRecommendationBand.findFirst({
      where: { id: bandId, careerFitModelId: modelId },
      select: { id: true },
    });

    if (!band) {
      throw new NotFoundException({
        code: "CAREER_FIT_RECOMMENDATION_BAND_NOT_FOUND",
        message: "Career-fit recommendation band not found.",
      });
    }

    return band;
  }

  private findBandOverlapIssues(
    bands: Array<{
      id: string;
      code: string;
      lowerBound: Prisma.Decimal | null;
      upperBound: Prisma.Decimal | null;
      lowerInclusive: boolean;
      upperInclusive: boolean;
    }>,
  ): PublicationIssue[] {
    const issues: PublicationIssue[] = [];

    for (let leftIndex = 0; leftIndex < bands.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bands.length; rightIndex += 1) {
        const left = bands[leftIndex];
        const right = bands[rightIndex];

        if (!left || !right) {
          continue;
        }

        if (this.bandsOverlap(left, right)) {
          issues.push({
            code: "CAREER_FIT_RECOMMENDATION_BANDS_OVERLAP",
            message: `Recommendation bands ${left.code} and ${right.code} overlap.`,
            recommendationBandId: right.id,
          });
        }
      }
    }

    return issues;
  }

  private bandsOverlap(
    left: {
      lowerBound: Prisma.Decimal | null;
      upperBound: Prisma.Decimal | null;
      lowerInclusive: boolean;
      upperInclusive: boolean;
    },
    right: {
      lowerBound: Prisma.Decimal | null;
      upperBound: Prisma.Decimal | null;
      lowerInclusive: boolean;
      upperInclusive: boolean;
    },
  ): boolean {
    const leftLow = left.lowerBound === null ? Number.NEGATIVE_INFINITY : Number(left.lowerBound);
    const leftHigh = left.upperBound === null ? Number.POSITIVE_INFINITY : Number(left.upperBound);
    const rightLow =
      right.lowerBound === null ? Number.NEGATIVE_INFINITY : Number(right.lowerBound);
    const rightHigh =
      right.upperBound === null ? Number.POSITIVE_INFINITY : Number(right.upperBound);

    if (leftHigh < rightLow || rightHigh < leftLow) {
      return false;
    }

    if (leftHigh === rightLow) {
      return left.upperInclusive && right.lowerInclusive;
    }

    if (rightHigh === leftLow) {
      return right.upperInclusive && left.lowerInclusive;
    }

    return true;
  }

  private async createAuditLog(
    client: Prisma.TransactionClient,
    context: AuthContext,
    entry: {
      action: string;
      entityType: string;
      entityId: string;
      metadata: Prisma.InputJsonValue;
    },
  ) {
    await client.auditLog.create({
      data: {
        organizationId: null,
        actorUserId: context.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
      select: { id: true },
    });
  }

  private assertPlatformAdmin(context: AuthContext): void {
    if (context.role !== MembershipRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: "CAREER_INTELLIGENCE_PLATFORM_ADMIN_REQUIRED",
        message:
          "Career taxonomy and fit-model governance is restricted to platform administrators.",
      });
    }
  }

  private throwKnownConflict(error: unknown, code: string, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException({ code, message });
    }

    throw error;
  }

  private throwKnownReferenceConflict(error: unknown, code: string, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ConflictException({ code, message });
    }

    throw error;
  }

  private throwPublicationConcurrencyConflict(
    error: unknown,
    code: string,
    message: string,
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new ConflictException({ code, message });
    }

    throw error;
  }
}
