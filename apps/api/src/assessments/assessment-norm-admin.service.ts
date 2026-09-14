import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentNormSetStatus, MembershipRole, Prisma, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  CreateAssessmentConstructNormTableDto,
  CreateAssessmentNormGroupDto,
  CreateAssessmentNormLookupRowDto,
  CreateAssessmentNormSetDto,
} from "./assessment-norm-admin.types";

const normSetSelect = {
  id: true,
  assessmentVersionId: true,
  normVersion: true,
  name: true,
  description: true,
  sourceReference: true,
  populationMetadata: true,
  status: true,
  publishedAt: true,
  retiredAt: true,
  createdAt: true,
} satisfies Prisma.AssessmentNormSetSelect;

/**
 * Authoring API for norm sets/groups/construct-norm-tables/lookup rows (the content
 * AssessmentNormService.applyPublishedNormGroup consumes at report time). Nothing here
 * changes scoring behavior; it only lets an operator create the content that was
 * previously reachable only by inserting rows directly against the database.
 *
 * V1 scope (D-002/D-004, matching AssessmentReportPipelineService's own assumption):
 * a norm set may publish with at most one norm group, since the report pipeline throws
 * rather than guess which published group to use when more than one exists.
 */
@Injectable()
export class AssessmentNormAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listNormSets(context: AuthContext, definitionId: string, versionId: string) {
    await this.requireVersionInScope(context, definitionId, versionId);

    return this.prisma.assessmentNormSet.findMany({
      where: { assessmentVersionId: versionId },
      orderBy: [{ createdAt: "desc" }],
      select: normSetSelect,
    });
  }

  public async createNormSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    body: CreateAssessmentNormSetDto,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    try {
      return await this.prisma.assessmentNormSet.create({
        data: {
          assessmentVersionId: versionId,
          normVersion: body.normVersion.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          sourceReference: body.sourceReference?.trim() || null,
          populationMetadata:
            (body.populationMetadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        select: normSetSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_SET_CONFLICT",
          message: "A norm set with this norm version already exists for this assessment version.",
        });
      }

      throw error;
    }
  }

  public async getNormSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    const normSet = await this.prisma.assessmentNormSet.findFirst({
      where: { id: normSetId, assessmentVersionId: versionId },
      select: {
        ...normSetSelect,
        groups: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            sampleSize: true,
            createdAt: true,
            constructTables: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                id: true,
                assessmentConstructId: true,
                assessmentConstruct: {
                  select: { code: true, name: true },
                },
                rows: {
                  orderBy: [{ rawScoreMin: "asc" }],
                  select: {
                    id: true,
                    rawScoreMin: true,
                    rawScoreMax: true,
                    standardizedScore: true,
                    percentile: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!normSet) {
      throw new NotFoundException({
        code: "ASSESSMENT_NORM_SET_NOT_FOUND",
        message: "Norm set not found.",
      });
    }

    return normSet;
  }

  public async createNormGroup(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
    body: CreateAssessmentNormGroupDto,
  ) {
    await this.requireWritableNormSet(context, definitionId, versionId, normSetId);

    try {
      return await this.prisma.assessmentNormGroup.create({
        data: {
          normSetId,
          code: body.code.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          criteria: (body.criteria as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
          sampleSize: body.sampleSize ?? null,
          metadata: (body.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        select: {
          id: true,
          normSetId: true,
          code: true,
          name: true,
          description: true,
          sampleSize: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_GROUP_CONFLICT",
          message: "A norm group with this code already exists in this norm set.",
        });
      }

      throw error;
    }
  }

  public async createConstructNormTable(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
    normGroupId: string,
    body: CreateAssessmentConstructNormTableDto,
  ) {
    await this.requireWritableNormSet(context, definitionId, versionId, normSetId);

    const [group, construct] = await Promise.all([
      this.prisma.assessmentNormGroup.findFirst({
        where: { id: normGroupId, normSetId },
        select: { id: true },
      }),
      this.prisma.assessmentConstruct.findFirst({
        where: { id: body.assessmentConstructId, assessmentVersionId: versionId },
        select: { id: true },
      }),
    ]);

    if (!group) {
      throw new NotFoundException({
        code: "ASSESSMENT_NORM_GROUP_NOT_FOUND",
        message: "Norm group not found.",
      });
    }

    if (!construct) {
      throw new NotFoundException({
        code: "ASSESSMENT_CONSTRUCT_NOT_FOUND",
        message: "Assessment construct not found for this assessment version.",
      });
    }

    try {
      return await this.prisma.assessmentConstructNormTable.create({
        data: {
          normGroupId,
          assessmentConstructId: construct.id,
          metadata: (body.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        select: {
          id: true,
          normGroupId: true,
          assessmentConstructId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_TABLE_CONFLICT",
          message: "A norm table for this construct already exists in this norm group.",
        });
      }

      throw error;
    }
  }

  public async createNormLookupRow(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
    normGroupId: string,
    constructNormTableId: string,
    body: CreateAssessmentNormLookupRowDto,
  ) {
    await this.requireWritableNormSet(context, definitionId, versionId, normSetId);

    const table = await this.prisma.assessmentConstructNormTable.findFirst({
      where: { id: constructNormTableId, normGroupId },
      select: {
        id: true,
        rows: {
          select: { rawScoreMin: true, rawScoreMax: true },
        },
      },
    });

    if (!table) {
      throw new NotFoundException({
        code: "ASSESSMENT_NORM_TABLE_NOT_FOUND",
        message: "Norm table not found.",
      });
    }

    if (body.rawScoreMax < body.rawScoreMin) {
      throw new ConflictException({
        code: "ASSESSMENT_NORM_LOOKUP_RANGE_INVALID",
        message: "rawScoreMax must be greater than or equal to rawScoreMin.",
      });
    }

    // Overlapping intervals within one table are ambiguous: at report time,
    // AssessmentNormService.applyPublishedNormGroup throws
    // ASSESSMENT_NORM_LOOKUP_AMBIGUOUS if more than one row matches a raw score. Reject
    // the overlap here instead of letting it surface as a candidate-facing failure.
    const overlaps = table.rows.some(
      (row) =>
        body.rawScoreMin <= Number(row.rawScoreMax) && Number(row.rawScoreMin) <= body.rawScoreMax,
    );

    if (overlaps) {
      throw new ConflictException({
        code: "ASSESSMENT_NORM_LOOKUP_RANGE_OVERLAPS",
        message: "This raw score range overlaps an existing lookup row in the same norm table.",
      });
    }

    try {
      return await this.prisma.assessmentNormLookupRow.create({
        data: {
          constructNormTableId: table.id,
          rawScoreMin: body.rawScoreMin,
          rawScoreMax: body.rawScoreMax,
          standardizedScore: body.standardizedScore ?? null,
          percentile: body.percentile ?? null,
          metadata: (body.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        select: {
          id: true,
          constructNormTableId: true,
          rawScoreMin: true,
          rawScoreMax: true,
          standardizedScore: true,
          percentile: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_LOOKUP_RANGE_CONFLICT",
          message: "An identical raw score range already exists in this norm table.",
        });
      }

      throw error;
    }
  }

  public async getPublicationReadiness(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
  ) {
    await this.requireWritableNormSet(context, definitionId, versionId, normSetId);

    return this.getPublicationReadinessWithClient(this.prisma, versionId, normSetId);
  }

  private async getPublicationReadinessWithClient(
    client: Prisma.TransactionClient | PrismaClient,
    versionId: string,
    normSetId: string,
  ) {
    const [constructs, groups] = await Promise.all([
      client.assessmentConstruct.findMany({
        where: { assessmentVersionId: versionId },
        select: { id: true, code: true },
      }),
      client.assessmentNormGroup.findMany({
        where: { normSetId },
        select: {
          id: true,
          code: true,
          constructTables: {
            select: {
              assessmentConstructId: true,
              rows: { select: { id: true } },
            },
          },
        },
      }),
    ]);

    const issues: Array<{ code: string; message: string; constructId?: string }> = [];

    if (groups.length === 0) {
      issues.push({
        code: "ASSESSMENT_NORM_SET_HAS_NO_GROUP",
        message: "The norm set must contain a norm group before publication.",
      });
    } else if (groups.length > 1) {
      issues.push({
        code: "ASSESSMENT_NORM_SET_HAS_MULTIPLE_GROUPS",
        message:
          "V1 supports exactly one norm group per published norm set. Remove or move extra groups before publishing.",
      });
    } else {
      const [group] = groups;

      if (group) {
        const tablesByConstruct = new Map(
          group.constructTables.map((table) => [table.assessmentConstructId, table]),
        );

        for (const construct of constructs) {
          const table = tablesByConstruct.get(construct.id);

          if (!table) {
            issues.push({
              code: "ASSESSMENT_NORM_TABLE_MISSING",
              message: `Construct "${construct.code}" has no norm table in this group.`,
              constructId: construct.id,
            });
            continue;
          }

          if (table.rows.length === 0) {
            issues.push({
              code: "ASSESSMENT_NORM_TABLE_HAS_NO_ROWS",
              message: `Construct "${construct.code}"'s norm table has no lookup rows.`,
              constructId: construct.id,
            });
          }
        }
      }
    }

    return {
      normSetId,
      ready: issues.length === 0,
      issues,
    };
  }

  public async publishNormSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (transaction) =>
          this.publishNormSetInTransaction(
            transaction,
            context,
            definitionId,
            versionId,
            normSetId,
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException({
          code: "ASSESSMENT_NORM_SET_PUBLICATION_CONCURRENCY_CONFLICT",
          message: "The norm set changed while publication was being finalized. Try again.",
        });
      }

      throw error;
    }
  }

  private async publishNormSetInTransaction(
    transaction: Prisma.TransactionClient,
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
  ) {
    await this.requireWritableNormSet(context, definitionId, versionId, normSetId, transaction);

    const readiness = await this.getPublicationReadinessWithClient(
      transaction,
      versionId,
      normSetId,
    );

    if (!readiness.ready) {
      throw new ConflictException({
        code: "ASSESSMENT_NORM_SET_NOT_READY_FOR_PUBLICATION",
        message: "Norm set failed publication readiness checks.",
        issues: readiness.issues,
      });
    }

    return transaction.assessmentNormSet.update({
      where: { id: normSetId },
      data: { status: AssessmentNormSetStatus.PUBLISHED, publishedAt: new Date() },
      select: normSetSelect,
    });
  }

  public async retireNormSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
  ) {
    const normSet = await this.requireVersionScopedNormSet(
      context,
      definitionId,
      versionId,
      normSetId,
    );

    if (normSet.status !== AssessmentNormSetStatus.PUBLISHED) {
      throw new ConflictException({
        code: "ASSESSMENT_NORM_SET_NOT_PUBLISHED",
        message: "Only a published norm set may be retired.",
      });
    }

    return this.prisma.assessmentNormSet.update({
      where: { id: normSetId },
      data: { status: AssessmentNormSetStatus.RETIRED, retiredAt: new Date() },
      select: normSetSelect,
    });
  }

  private async requireVersionInScope(
    context: AuthContext,
    definitionId: string,
    versionId: string,
  ) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        assessmentDefinitionId: true,
        assessmentDefinition: { select: { organizationId: true } },
      },
    });

    if (!version || version.assessmentDefinitionId !== definitionId) {
      throw new NotFoundException({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found.",
      });
    }

    this.assertWriteAccess(context, version.assessmentDefinition.organizationId);

    return version;
  }

  private async requireVersionScopedNormSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    const normSet = await client.assessmentNormSet.findFirst({
      where: { id: normSetId, assessmentVersionId: versionId },
      select: normSetSelect,
    });

    if (!normSet) {
      throw new NotFoundException({
        code: "ASSESSMENT_NORM_SET_NOT_FOUND",
        message: "Norm set not found.",
      });
    }

    return normSet;
  }

  private async requireWritableNormSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    normSetId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    const normSet = await this.requireVersionScopedNormSet(
      context,
      definitionId,
      versionId,
      normSetId,
      client,
    );

    if (normSet.status !== AssessmentNormSetStatus.DRAFT) {
      throw new ConflictException({
        code: "ASSESSMENT_NORM_SET_NOT_DRAFT",
        message: "Only a draft norm set may be modified.",
      });
    }

    return normSet;
  }

  private assertWriteAccess(context: AuthContext, definitionOrganizationId: string | null): void {
    if (context.role === MembershipRole.SUPER_ADMIN) {
      if (definitionOrganizationId !== null) {
        throw new ForbiddenException({
          code: "ASSESSMENT_ADMIN_SCOPE_FORBIDDEN",
          message: "Platform administrators may modify only platform-owned assessment definitions.",
        });
      }

      return;
    }

    const organizationId = this.requireOrganization(context);

    if (definitionOrganizationId !== organizationId) {
      throw new ForbiddenException({
        code: "ASSESSMENT_ADMIN_SCOPE_FORBIDDEN",
        message:
          "Organization administrators may modify only their organization's assessment definitions.",
      });
    }
  }

  private requireOrganization(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_SCOPE_REQUIRED",
        message: "Organization scope is required.",
      });
    }

    return context.organizationId;
  }
}
