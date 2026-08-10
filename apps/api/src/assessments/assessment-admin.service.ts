import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentItemType,
  AssessmentVersionStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  CreateAssessmentConstructDto,
  CreateAssessmentDefinitionDto,
  CreateAssessmentItemDto,
  CreateAssessmentItemConstructDto,
  CreateAssessmentItemOptionDto,
  CreateAssessmentOptionScoreDto,
  CreateAssessmentVersionDto,
  UpdateAssessmentVersionDto,
} from "./assessment-admin.types";

@Injectable()
export class AssessmentAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listDefinitions(context: AuthContext) {
    const where =
      context.role === MembershipRole.SUPER_ADMIN
        ? {}
        : {
            OR: [{ organizationId: null }, { organizationId: this.requireOrganization(context) }],
          };

    return this.prisma.assessmentDefinition.findMany({
      where,
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        organizationId: true,
        code: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            title: true,
            edition: true,
            form: true,
            language: true,
            scoringVersion: true,
            normVersion: true,
            reportVersion: true,
            createdAt: true,
            publishedAt: true,
            retiredAt: true,
          },
        },
      },
    });
  }

  public async getDefinition(context: AuthContext, definitionId: string) {
    const definition = await this.prisma.assessmentDefinition.findFirst({
      where: {
        id: definitionId,
        ...this.readScope(context),
      },
      select: {
        id: true,
        organizationId: true,
        code: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: {
            versionNumber: "desc",
          },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            title: true,
            edition: true,
            form: true,
            language: true,
            scoringVersion: true,
            normVersion: true,
            reportVersion: true,
            description: true,
            instructions: true,
            createdAt: true,
            publishedAt: true,
            retiredAt: true,
          },
        },
      },
    });

    if (!definition) {
      throw new NotFoundException({
        code: "ASSESSMENT_DEFINITION_NOT_FOUND",
        message: "Assessment definition not found.",
      });
    }

    return definition;
  }

  public async createDefinition(context: AuthContext, body: CreateAssessmentDefinitionDto) {
    const organizationId =
      context.role === MembershipRole.SUPER_ADMIN ? null : this.requireOrganization(context);

    try {
      return await this.prisma.assessmentDefinition.create({
        data: {
          organizationId,
          code: body.code.trim(),
          createdByUserId: context.userId,
        },
        select: {
          id: true,
          organizationId: true,
          code: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_DEFINITION_CODE_CONFLICT",
          message: "An assessment definition with this code already exists.",
        });
      }

      throw error;
    }
  }

  public async createDraftVersion(
    context: AuthContext,
    definitionId: string,
    body: CreateAssessmentVersionDto,
  ) {
    const definition = await this.prisma.assessmentDefinition.findUnique({
      where: {
        id: definitionId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!definition) {
      throw new NotFoundException({
        code: "ASSESSMENT_DEFINITION_NOT_FOUND",
        message: "Assessment definition not found.",
      });
    }

    this.assertWriteAccess(context, definition.organizationId);

    try {
      return await this.prisma.assessmentVersion.create({
        data: {
          assessmentDefinitionId: definition.id,
          versionNumber: body.versionNumber,
          status: AssessmentVersionStatus.DRAFT,
          title: body.title.trim(),
          edition: body.edition.trim(),
          form: body.form.trim(),
          language: body.language.trim(),
          scoringVersion: body.scoringVersion.trim(),
          normVersion: body.normVersion.trim(),
          reportVersion: body.reportVersion.trim(),
          description: body.description?.trim() || null,
          instructions: body.instructions?.trim() || null,
          createdByUserId: context.userId,
        },
        select: {
          id: true,
          assessmentDefinitionId: true,
          versionNumber: true,
          status: true,
          title: true,
          edition: true,
          form: true,
          language: true,
          scoringVersion: true,
          normVersion: true,
          reportVersion: true,
          description: true,
          instructions: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_VERSION_CONFLICT",
          message: "This assessment version number already exists.",
        });
      }

      throw error;
    }
  }

  public async updateDraftVersion(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    body: UpdateAssessmentVersionDto,
  ) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: {
        id: versionId,
      },
      select: {
        id: true,
        assessmentDefinitionId: true,
        status: true,
        assessmentDefinition: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!version || version.assessmentDefinitionId !== definitionId) {
      throw new NotFoundException({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found.",
      });
    }

    this.assertWriteAccess(context, version.assessmentDefinition.organizationId);

    if (version.status !== AssessmentVersionStatus.DRAFT) {
      throw new ConflictException({
        code: "ASSESSMENT_VERSION_NOT_DRAFT",
        message: "Only draft assessment versions may be edited.",
      });
    }

    const data: Prisma.AssessmentVersionUpdateInput = {};

    if (body.title !== undefined) data.title = body.title.trim();
    if (body.edition !== undefined) data.edition = body.edition.trim();
    if (body.form !== undefined) data.form = body.form.trim();
    if (body.language !== undefined) data.language = body.language.trim();
    if (body.scoringVersion !== undefined) {
      data.scoringVersion = body.scoringVersion.trim();
    }
    if (body.normVersion !== undefined) {
      data.normVersion = body.normVersion.trim();
    }
    if (body.reportVersion !== undefined) {
      data.reportVersion = body.reportVersion.trim();
    }
    if (body.description !== undefined) {
      data.description = body.description.trim() || null;
    }
    if (body.instructions !== undefined) {
      data.instructions = body.instructions.trim() || null;
    }

    return this.prisma.assessmentVersion.update({
      where: {
        id: version.id,
      },
      data,
      select: {
        id: true,
        assessmentDefinitionId: true,
        versionNumber: true,
        status: true,
        title: true,
        edition: true,
        form: true,
        language: true,
        scoringVersion: true,
        normVersion: true,
        reportVersion: true,
        description: true,
        instructions: true,
        updatedAt: true,
      },
    });
  }

  public async getVersionContent(context: AuthContext, definitionId: string, versionId: string) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    return this.prisma.assessmentVersion.findUniqueOrThrow({
      where: {
        id: versionId,
      },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        constructs: {
          orderBy: {
            orderIndex: "asc",
          },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            orderIndex: true,
          },
        },
        items: {
          orderBy: {
            orderIndex: "asc",
          },
          select: {
            id: true,
            code: true,
            type: true,
            prompt: true,
            helpText: true,
            orderIndex: true,
            required: true,
            constructLinks: {
              select: {
                assessmentConstructId: true,
                weight: true,
                reverseScored: true,
              },
            },
            options: {
              orderBy: {
                orderIndex: "asc",
              },
              select: {
                id: true,
                code: true,
                label: true,
                orderIndex: true,
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
    });
  }

  public async createConstruct(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    body: CreateAssessmentConstructDto,
  ) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    try {
      return await this.prisma.assessmentConstruct.create({
        data: {
          assessmentVersionId: versionId,
          code: body.code.trim(),
          name: body.name.trim(),
          description: body.description?.trim() || null,
          orderIndex: body.orderIndex,
        },
        select: {
          id: true,
          assessmentVersionId: true,
          code: true,
          name: true,
          description: true,
          orderIndex: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_CONSTRUCT_CONFLICT",
          message: "A construct with this code or order already exists in the assessment version.",
        });
      }

      throw error;
    }
  }

  public async createItem(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    body: CreateAssessmentItemDto,
  ) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    try {
      return await this.prisma.assessmentItem.create({
        data: {
          assessmentVersionId: versionId,
          code: body.code.trim(),
          type: body.type,
          prompt: body.prompt.trim(),
          helpText: body.helpText?.trim() || null,
          orderIndex: body.orderIndex,
          required: body.required ?? true,
        },
        select: {
          id: true,
          assessmentVersionId: true,
          code: true,
          type: true,
          prompt: true,
          helpText: true,
          orderIndex: true,
          required: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_ITEM_CONFLICT",
          message: "An item with this code or order already exists in the assessment version.",
        });
      }

      throw error;
    }
  }

  public async createItemOption(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    itemId: string,
    body: CreateAssessmentItemOptionDto,
  ) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    const item = await this.prisma.assessmentItem.findFirst({
      where: {
        id: itemId,
        assessmentVersionId: versionId,
      },
      select: {
        id: true,
      },
    });

    if (!item) {
      throw new NotFoundException({
        code: "ASSESSMENT_ITEM_NOT_FOUND",
        message: "Assessment item not found.",
      });
    }

    try {
      return await this.prisma.assessmentItemOption.create({
        data: {
          assessmentItemId: item.id,
          code: body.code.trim(),
          label: body.label.trim(),
          orderIndex: body.orderIndex,
        },
        select: {
          id: true,
          assessmentItemId: true,
          code: true,
          label: true,
          orderIndex: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_ITEM_OPTION_CONFLICT",
          message: "An option with this code or order already exists for the assessment item.",
        });
      }

      throw error;
    }
  }

  public async createItemConstructLink(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    itemId: string,
    body: CreateAssessmentItemConstructDto,
  ) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    const [item, construct] = await Promise.all([
      this.prisma.assessmentItem.findFirst({
        where: {
          id: itemId,
          assessmentVersionId: versionId,
        },
        select: {
          id: true,
        },
      }),
      this.prisma.assessmentConstruct.findFirst({
        where: {
          id: body.constructId,
          assessmentVersionId: versionId,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!item) {
      throw new NotFoundException({
        code: "ASSESSMENT_ITEM_NOT_FOUND",
        message: "Assessment item not found.",
      });
    }

    if (!construct) {
      throw new NotFoundException({
        code: "ASSESSMENT_CONSTRUCT_NOT_FOUND",
        message: "Assessment construct not found.",
      });
    }

    try {
      return await this.prisma.assessmentItemConstruct.create({
        data: {
          assessmentItemId: item.id,
          assessmentConstructId: construct.id,
          weight: body.weight ?? 1,
          reverseScored: body.reverseScored ?? false,
        },
        select: {
          assessmentItemId: true,
          assessmentConstructId: true,
          weight: true,
          reverseScored: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_ITEM_CONSTRUCT_CONFLICT",
          message: "This item is already linked to the assessment construct.",
        });
      }

      throw error;
    }
  }

  public async createOptionScore(
    context: AuthContext,
    definitionId: string,
    versionId: string,
    itemId: string,
    optionId: string,
    body: CreateAssessmentOptionScoreDto,
  ) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    const [item, option, constructLink] = await Promise.all([
      this.prisma.assessmentItem.findFirst({
        where: {
          id: itemId,
          assessmentVersionId: versionId,
        },
        select: {
          id: true,
        },
      }),
      this.prisma.assessmentItemOption.findFirst({
        where: {
          id: optionId,
          assessmentItemId: itemId,
        },
        select: {
          id: true,
        },
      }),
      this.prisma.assessmentItemConstruct.findUnique({
        where: {
          assessmentItemId_assessmentConstructId: {
            assessmentItemId: itemId,
            assessmentConstructId: body.constructId,
          },
        },
        select: {
          assessmentItemId: true,
          assessmentConstructId: true,
        },
      }),
    ]);

    if (!item) {
      throw new NotFoundException({
        code: "ASSESSMENT_ITEM_NOT_FOUND",
        message: "Assessment item not found.",
      });
    }

    if (!option) {
      throw new NotFoundException({
        code: "ASSESSMENT_ITEM_OPTION_NOT_FOUND",
        message: "Assessment item option not found.",
      });
    }

    if (!constructLink) {
      throw new ConflictException({
        code: "ASSESSMENT_OPTION_SCORE_REQUIRES_CONSTRUCT_LINK",
        message:
          "The assessment item must be linked to the construct before an option score can be defined.",
      });
    }

    try {
      return await this.prisma.assessmentOptionScore.create({
        data: {
          assessmentItemOptionId: option.id,
          assessmentConstructId: body.constructId,
          score: body.score,
        },
        select: {
          assessmentItemOptionId: true,
          assessmentConstructId: true,
          score: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ASSESSMENT_OPTION_SCORE_CONFLICT",
          message: "A score for this option and construct has already been defined.",
        });
      }

      throw error;
    }
  }

  public async getPublicationReadiness(
    context: AuthContext,
    definitionId: string,
    versionId: string,
  ) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    const content = await this.prisma.assessmentVersion.findUniqueOrThrow({
      where: {
        id: versionId,
      },
      select: {
        id: true,
        assessmentDefinition: {
          select: {
            status: true,
          },
        },
        items: {
          orderBy: {
            orderIndex: "asc",
          },
          select: {
            id: true,
            code: true,
            type: true,
            options: {
              orderBy: {
                orderIndex: "asc",
              },
              select: {
                id: true,
                code: true,
                scores: {
                  select: {
                    assessmentConstructId: true,
                  },
                },
              },
            },
            constructLinks: {
              select: {
                assessmentConstructId: true,
              },
            },
          },
        },
      },
    });

    const issues: Array<{
      code: string;
      message: string;
      itemId?: string;
      optionId?: string;
      constructId?: string;
    }> = [];

    if (content.assessmentDefinition.status !== "ACTIVE") {
      issues.push({
        code: "ASSESSMENT_DEFINITION_NOT_ACTIVE",
        message: "An archived assessment definition cannot publish a new version.",
      });
    }

    if (content.items.length === 0) {
      issues.push({
        code: "ASSESSMENT_VERSION_HAS_NO_ITEMS",
        message: "The assessment version must contain at least one item before publication.",
      });
    }

    const optionScoredTypes = new Set<AssessmentItemType>([
      AssessmentItemType.SINGLE_CHOICE,
      AssessmentItemType.MULTIPLE_CHOICE,
      AssessmentItemType.LIKERT,
    ]);

    for (const item of content.items) {
      if (item.constructLinks.length === 0) {
        continue;
      }

      if (!optionScoredTypes.has(item.type)) {
        issues.push({
          code: "ASSESSMENT_SCORING_CONFIGURATION_UNSUPPORTED",
          message:
            "A scored assessment item uses a response type without an explicit scoring strategy.",
          itemId: item.id,
        });
        continue;
      }

      if (item.options.length === 0) {
        issues.push({
          code: "ASSESSMENT_SCORED_ITEM_HAS_NO_OPTIONS",
          message: "A scored option-based assessment item must contain at least one option.",
          itemId: item.id,
        });
        continue;
      }

      const requiredConstructIds = new Set(
        item.constructLinks.map((link) => link.assessmentConstructId),
      );

      for (const option of item.options) {
        const scoredConstructIds = new Set(
          option.scores.map((score) => score.assessmentConstructId),
        );

        for (const constructId of requiredConstructIds) {
          if (!scoredConstructIds.has(constructId)) {
            issues.push({
              code: "ASSESSMENT_OPTION_SCORE_INCOMPLETE",
              message:
                "Every option of a scored item must define an explicit score for every linked construct.",
              itemId: item.id,
              optionId: option.id,
              constructId,
            });
          }
        }
      }
    }

    return {
      versionId: content.id,
      ready: issues.length === 0,
      issues,
    };
  }

  public async publishVersion(context: AuthContext, definitionId: string, versionId: string) {
    await this.requireWritableDraftVersion(context, definitionId, versionId);

    const readiness = await this.getPublicationReadiness(context, definitionId, versionId);

    if (!readiness.ready) {
      throw new ConflictException({
        code: "ASSESSMENT_VERSION_NOT_READY_FOR_PUBLICATION",
        message: "Assessment version failed publication readiness checks.",
        issues: readiness.issues,
      });
    }

    const publishedAt = new Date();

    return this.prisma.assessmentVersion.update({
      where: {
        id: versionId,
      },
      data: {
        status: AssessmentVersionStatus.PUBLISHED,
        publishedAt,
        publishedByUserId: context.userId,
      },
      select: {
        id: true,
        assessmentDefinitionId: true,
        versionNumber: true,
        status: true,
        publishedByUserId: true,
        publishedAt: true,
        retiredAt: true,
      },
    });
  }

  public async retireVersion(context: AuthContext, definitionId: string, versionId: string) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: {
        id: versionId,
      },
      select: {
        id: true,
        assessmentDefinitionId: true,
        status: true,
        assessmentDefinition: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!version || version.assessmentDefinitionId !== definitionId) {
      throw new NotFoundException({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found.",
      });
    }

    this.assertWriteAccess(context, version.assessmentDefinition.organizationId);

    if (version.status !== AssessmentVersionStatus.PUBLISHED) {
      throw new ConflictException({
        code: "ASSESSMENT_VERSION_NOT_PUBLISHED",
        message: "Only a published assessment version may be retired.",
      });
    }

    return this.prisma.assessmentVersion.update({
      where: {
        id: versionId,
      },
      data: {
        status: AssessmentVersionStatus.RETIRED,
        retiredAt: new Date(),
      },
      select: {
        id: true,
        assessmentDefinitionId: true,
        versionNumber: true,
        status: true,
        publishedByUserId: true,
        publishedAt: true,
        retiredAt: true,
      },
    });
  }

  private async requireWritableDraftVersion(
    context: AuthContext,
    definitionId: string,
    versionId: string,
  ) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: {
        id: versionId,
      },
      select: {
        id: true,
        assessmentDefinitionId: true,
        status: true,
        assessmentDefinition: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!version || version.assessmentDefinitionId !== definitionId) {
      throw new NotFoundException({
        code: "ASSESSMENT_VERSION_NOT_FOUND",
        message: "Assessment version not found.",
      });
    }

    this.assertWriteAccess(context, version.assessmentDefinition.organizationId);

    if (version.status !== AssessmentVersionStatus.DRAFT) {
      throw new ConflictException({
        code: "ASSESSMENT_VERSION_NOT_DRAFT",
        message: "Only draft assessment versions may be modified.",
      });
    }

    return version;
  }

  private readScope(context: AuthContext) {
    if (context.role === MembershipRole.SUPER_ADMIN) {
      return {};
    }

    const organizationId = this.requireOrganization(context);

    return {
      OR: [{ organizationId: null }, { organizationId }],
    };
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
