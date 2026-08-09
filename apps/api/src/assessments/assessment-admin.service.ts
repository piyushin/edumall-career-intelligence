import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentVersionStatus, MembershipRole, Prisma, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  CreateAssessmentDefinitionDto,
  CreateAssessmentVersionDto,
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
