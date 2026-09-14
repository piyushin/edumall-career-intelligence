import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentInterpretationSetStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  CreateAssessmentInterpretationRuleDto,
  CreateAssessmentInterpretationSetDto,
} from "./assessment-interpretation-admin.types";

const interpretationSetSelect = {
  id: true,
  assessmentVersionId: true,
  version: true,
  name: true,
  description: true,
  sourceReference: true,
  methodology: true,
  status: true,
  publishedAt: true,
  retiredAt: true,
  createdAt: true,
} satisfies Prisma.AssessmentInterpretationSetSelect;

interface RuleBounds {
  lowerBound: number | null;
  upperBound: number | null;
  lowerInclusive: boolean;
  upperInclusive: boolean;
}

/** True when two bound ranges (null = unbounded) share at least one value. */
function boundsOverlap(a: RuleBounds, b: RuleBounds): boolean {
  if (a.upperBound !== null && b.lowerBound !== null) {
    if (a.upperBound < b.lowerBound) return false;
    if (a.upperBound === b.lowerBound && !(a.upperInclusive && b.lowerInclusive)) return false;
  }

  if (b.upperBound !== null && a.lowerBound !== null) {
    if (b.upperBound < a.lowerBound) return false;
    if (b.upperBound === a.lowerBound && !(b.upperInclusive && a.lowerInclusive)) return false;
  }

  return true;
}

/**
 * Authoring API for interpretation sets/rules (the content
 * AssessmentInterpretationService.applyPublishedInterpretationSet consumes at report
 * time). Mirrors AssessmentNormAdminService's shape: draft-only mutation (the DB's
 * protect_published_assessment_interpretation_content trigger enforces the same rule),
 * and publish-readiness checks that front-load the pipeline's own runtime failure modes
 * (ASSESSMENT_INTERPRETATION_RULE_MISSING / _AMBIGUOUS, and the report pipeline's "exactly
 * one published interpretation set" assumption) into an authoring-time error instead of a
 * candidate-facing one.
 */
@Injectable()
export class AssessmentInterpretationAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listInterpretationSets(
    context: AuthContext,
    definitionId: string,
    versionId: string,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    return this.prisma.assessmentInterpretationSet.findMany({
      where: { assessmentVersionId: versionId },
      orderBy: [{ createdAt: "desc" }],
      select: interpretationSetSelect,
    });
  }

  public async createInterpretationSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    body: CreateAssessmentInterpretationSetDto,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    try {
      return await this.prisma.assessmentInterpretationSet.create({
        data: {
          assessmentVersionId: versionId,
          version: body.version.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          sourceReference: body.sourceReference?.trim() || null,
          methodology: (body.methodology as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        select: interpretationSetSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_INTERPRETATION_SET_CONFLICT",
          message:
            "An interpretation set with this version already exists for this assessment version.",
        });
      }

      throw error;
    }
  }

  public async getInterpretationSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    const interpretationSet = await this.prisma.assessmentInterpretationSet.findFirst({
      where: { id: interpretationSetId, assessmentVersionId: versionId },
      select: {
        ...interpretationSetSelect,
        rules: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            assessmentConstructId: true,
            assessmentConstruct: { select: { code: true, name: true } },
            code: true,
            metric: true,
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

    if (!interpretationSet) {
      throw new NotFoundException({
        code: "ASSESSMENT_INTERPRETATION_SET_NOT_FOUND",
        message: "Interpretation set not found.",
      });
    }

    return interpretationSet;
  }

  public async createInterpretationRule(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
    body: CreateAssessmentInterpretationRuleDto,
  ) {
    await this.requireWritableInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );

    if (
      body.lowerBound !== undefined &&
      body.upperBound !== undefined &&
      body.lowerBound > body.upperBound
    ) {
      throw new ConflictException({
        code: "ASSESSMENT_INTERPRETATION_RULE_RANGE_INVALID",
        message: "lowerBound must be less than or equal to upperBound.",
      });
    }

    const construct = await this.prisma.assessmentConstruct.findFirst({
      where: { id: body.assessmentConstructId, assessmentVersionId: versionId },
      select: { id: true },
    });

    if (!construct) {
      throw new NotFoundException({
        code: "ASSESSMENT_CONSTRUCT_NOT_FOUND",
        message: "Assessment construct not found for this assessment version.",
      });
    }

    const priority = body.priority ?? 0;
    const newBounds: RuleBounds = {
      lowerBound: body.lowerBound ?? null,
      upperBound: body.upperBound ?? null,
      lowerInclusive: body.lowerInclusive ?? true,
      upperInclusive: body.upperInclusive ?? true,
    };

    // Overlapping bound ranges are how a fallback/override rule is meant to work
    // (the highest-priority match wins at report time), so only reject an overlap
    // between rules of the *same* priority for the same construct+metric -- that
    // combination is genuinely ambiguous and would make
    // AssessmentInterpretationService.applyPublishedInterpretationSet throw
    // ASSESSMENT_INTERPRETATION_RULE_AMBIGUOUS for any candidate whose score lands in
    // the overlap.
    const samePriorityRules = await this.prisma.assessmentInterpretationRule.findMany({
      where: {
        interpretationSetId,
        assessmentConstructId: construct.id,
        metric: body.metric,
        priority,
      },
      select: {
        code: true,
        lowerBound: true,
        upperBound: true,
        lowerInclusive: true,
        upperInclusive: true,
      },
    });

    const conflicting = samePriorityRules.find((rule) =>
      boundsOverlap(newBounds, {
        lowerBound: rule.lowerBound !== null ? Number(rule.lowerBound) : null,
        upperBound: rule.upperBound !== null ? Number(rule.upperBound) : null,
        lowerInclusive: rule.lowerInclusive,
        upperInclusive: rule.upperInclusive,
      }),
    );

    if (conflicting) {
      throw new ConflictException({
        code: "ASSESSMENT_INTERPRETATION_RULE_RANGE_OVERLAPS",
        message: `This range overlaps rule "${conflicting.code}", which has the same priority and metric for this construct. Give one of them a higher priority or a non-overlapping range.`,
      });
    }

    try {
      return await this.prisma.assessmentInterpretationRule.create({
        data: {
          interpretationSetId,
          assessmentConstructId: construct.id,
          code: body.code.trim(),
          metric: body.metric,
          lowerBound: newBounds.lowerBound,
          upperBound: newBounds.upperBound,
          lowerInclusive: newBounds.lowerInclusive,
          upperInclusive: newBounds.upperInclusive,
          priority,
          outputData: (body.outputData as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
          metadata: (body.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        select: {
          id: true,
          interpretationSetId: true,
          assessmentConstructId: true,
          code: true,
          metric: true,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_INTERPRETATION_RULE_CONFLICT",
          message: "A rule with this code already exists in this interpretation set.",
        });
      }

      throw error;
    }
  }

  public async getPublicationReadiness(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
  ) {
    await this.requireWritableInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );

    return this.getPublicationReadinessWithClient(this.prisma, versionId, interpretationSetId);
  }

  private async getPublicationReadinessWithClient(
    client: Prisma.TransactionClient | PrismaClient,
    versionId: string,
    interpretationSetId: string,
  ) {
    const [constructs, rules] = await Promise.all([
      client.assessmentConstruct.findMany({
        where: { assessmentVersionId: versionId },
        select: { id: true, code: true },
      }),
      client.assessmentInterpretationRule.findMany({
        where: { interpretationSetId },
        select: { assessmentConstructId: true },
      }),
    ]);

    const constructsWithRules = new Set(rules.map((rule) => rule.assessmentConstructId));

    const issues: Array<{ code: string; message: string; constructId?: string }> = constructs
      .filter((construct) => !constructsWithRules.has(construct.id))
      .map((construct) => ({
        code: "ASSESSMENT_INTERPRETATION_RULE_MISSING_FOR_CONSTRUCT",
        message: `Construct "${construct.code}" has no interpretation rule.`,
        constructId: construct.id,
      }));

    return {
      interpretationSetId,
      ready: issues.length === 0,
      issues,
    };
  }

  public async publishInterpretationSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
  ) {
    try {
      return await this.prisma.$transaction(
        async (transaction) =>
          this.publishInterpretationSetInTransaction(
            transaction,
            context,
            definitionId,
            versionId,
            interpretationSetId,
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException({
          code: "ASSESSMENT_INTERPRETATION_SET_PUBLICATION_CONCURRENCY_CONFLICT",
          message:
            "The interpretation set changed while publication was being finalized. Try again.",
        });
      }

      throw error;
    }
  }

  private async publishInterpretationSetInTransaction(
    transaction: Prisma.TransactionClient,
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
  ) {
    await this.requireWritableInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
      transaction,
    );

    const readiness = await this.getPublicationReadinessWithClient(
      transaction,
      versionId,
      interpretationSetId,
    );

    if (!readiness.ready) {
      throw new ConflictException({
        code: "ASSESSMENT_INTERPRETATION_SET_NOT_READY_FOR_PUBLICATION",
        message: "Interpretation set failed publication readiness checks.",
        issues: readiness.issues,
      });
    }

    // The report pipeline requires exactly one PUBLISHED interpretation set per
    // assessment version (it throws ASSESSMENT_REPORT_INTERPRETATION_SET_AMBIGUOUS
    // otherwise); there is no DB-level constraint for that, so it is enforced here.
    const otherPublished = await transaction.assessmentInterpretationSet.findFirst({
      where: {
        assessmentVersionId: versionId,
        status: AssessmentInterpretationSetStatus.PUBLISHED,
        id: { not: interpretationSetId },
      },
      select: { id: true, version: true },
    });

    if (otherPublished) {
      throw new ConflictException({
        code: "ASSESSMENT_INTERPRETATION_SET_ALREADY_PUBLISHED",
        message: `Interpretation set version "${otherPublished.version}" is already published for this assessment version. Retire it before publishing another.`,
      });
    }

    return transaction.assessmentInterpretationSet.update({
      where: { id: interpretationSetId },
      data: { status: AssessmentInterpretationSetStatus.PUBLISHED, publishedAt: new Date() },
      select: interpretationSetSelect,
    });
  }

  public async retireInterpretationSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
  ) {
    const interpretationSet = await this.requireVersionScopedInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );

    if (interpretationSet.status !== AssessmentInterpretationSetStatus.PUBLISHED) {
      throw new ConflictException({
        code: "ASSESSMENT_INTERPRETATION_SET_NOT_PUBLISHED",
        message: "Only a published interpretation set may be retired.",
      });
    }

    return this.prisma.assessmentInterpretationSet.update({
      where: { id: interpretationSetId },
      data: { status: AssessmentInterpretationSetStatus.RETIRED, retiredAt: new Date() },
      select: interpretationSetSelect,
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

  private async requireVersionScopedInterpretationSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    await this.requireVersionInScope(context, definitionId, versionId);

    const interpretationSet = await client.assessmentInterpretationSet.findFirst({
      where: { id: interpretationSetId, assessmentVersionId: versionId },
      select: interpretationSetSelect,
    });

    if (!interpretationSet) {
      throw new NotFoundException({
        code: "ASSESSMENT_INTERPRETATION_SET_NOT_FOUND",
        message: "Interpretation set not found.",
      });
    }

    return interpretationSet;
  }

  private async requireWritableInterpretationSet(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    interpretationSetId: string,
    client: Prisma.TransactionClient | PrismaClient = this.prisma,
  ) {
    const interpretationSet = await this.requireVersionScopedInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
      client,
    );

    if (interpretationSet.status !== AssessmentInterpretationSetStatus.DRAFT) {
      throw new ConflictException({
        code: "ASSESSMENT_INTERPRETATION_SET_NOT_DRAFT",
        message: "Only a draft interpretation set may be modified.",
      });
    }

    return interpretationSet;
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
