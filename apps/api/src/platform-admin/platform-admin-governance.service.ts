import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MembershipRole, Prisma, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  AdminAuditQueryDto,
  CreateAdminRoleTemplateDto,
  SetAdminRolePermissionsDto,
  UpdateAdminRoleTemplateDto,
} from "./platform-admin-governance.types";

@Injectable()
export class PlatformAdminGovernanceService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async createRoleTemplate(context: AuthContext, input: CreateAdminRoleTemplateDto) {
    this.assertSuperAdmin(context);

    const code = input.code.trim().toUpperCase();
    const permissionCodes = this.normalizePermissionCodes(input.permissionCodes);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const permissions = await this.requirePermissions(transaction, permissionCodes);

        const template = await transaction.adminRoleTemplate.create({
          data: {
            code,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            isSystem: false,
            isActive: true,
            createdByUserId: context.userId,
          },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            isSystem: true,
            isActive: true,
            createdAt: true,
          },
        });

        await transaction.adminRoleTemplatePermission.createMany({
          data: permissions.map((permission) => ({
            roleTemplateId: template.id,
            permissionId: permission.id,
          })),
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: context.userId,
            action: "admin.role_template.created",
            entityType: "AdminRoleTemplate",
            entityId: template.id,
            metadata: {
              code: template.code,
              name: template.name,
              permissionCodes,
            },
          },
        });

        return {
          ...template,
          permissionCodes,
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ADMIN_ROLE_TEMPLATE_CODE_CONFLICT",
          message: "An administrative role template with this code already exists.",
        });
      }

      throw error;
    }
  }

  public async updateRoleTemplate(
    context: AuthContext,
    roleTemplateId: string,
    input: UpdateAdminRoleTemplateDto,
  ) {
    this.assertSuperAdmin(context);

    const current = await this.prisma.adminRoleTemplate.findUnique({
      where: {
        id: roleTemplateId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
      },
    });

    if (!current) {
      throw new NotFoundException({
        code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
        message: "Administrative role template not found.",
      });
    }

    const data: Prisma.AdminRoleTemplateUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.description !== undefined) {
      data.description = input.description.trim() || null;
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.adminRoleTemplate.update({
        where: {
          id: current.id,
        },
        data,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isSystem: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.role_template.updated",
          entityType: "AdminRoleTemplate",
          entityId: current.id,
          metadata: {
            before: {
              name: current.name,
              description: current.description,
            },
            after: {
              name: updated.name,
              description: updated.description,
            },
          },
        },
      });

      return updated;
    });
  }

  public async replacePermissions(
    context: AuthContext,
    roleTemplateId: string,
    input: SetAdminRolePermissionsDto,
  ) {
    this.assertSuperAdmin(context);

    const permissionCodes = this.normalizePermissionCodes(input.permissionCodes);

    return this.prisma.$transaction(async (transaction) => {
      const template = await transaction.adminRoleTemplate.findUnique({
        where: {
          id: roleTemplateId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          permissions: {
            select: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      });

      if (!template) {
        throw new NotFoundException({
          code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
          message: "Administrative role template not found.",
        });
      }

      const permissions = await this.requirePermissions(transaction, permissionCodes);

      const previousPermissionCodes = template.permissions
        .map((link) => link.permission.code)
        .sort();

      await transaction.adminRoleTemplatePermission.deleteMany({
        where: {
          roleTemplateId: template.id,
        },
      });

      await transaction.adminRoleTemplatePermission.createMany({
        data: permissions.map((permission) => ({
          roleTemplateId: template.id,
          permissionId: permission.id,
        })),
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.role_template.permissions_replaced",
          entityType: "AdminRoleTemplate",
          entityId: template.id,
          metadata: {
            code: template.code,
            previousPermissionCodes,
            permissionCodes,
          },
        },
      });

      return {
        id: template.id,
        code: template.code,
        name: template.name,
        isActive: template.isActive,
        permissionCodes,
      };
    });
  }

  public activateRoleTemplate(context: AuthContext, roleTemplateId: string) {
    return this.setRoleTemplateStatus(context, roleTemplateId, true);
  }

  public deactivateRoleTemplate(context: AuthContext, roleTemplateId: string) {
    return this.setRoleTemplateStatus(context, roleTemplateId, false);
  }

  public listAuditLogs(context: AuthContext, query: AdminAuditQueryDto) {
    this.assertSuperAdmin(context);

    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    if (query.action?.trim()) {
      where.action = {
        contains: query.action.trim(),
        mode: "insensitive",
      };
    }

    if (query.entityType?.trim()) {
      where.entityType = {
        contains: query.entityType.trim(),
        mode: "insensitive",
      };
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};

      if (query.from) {
        createdAt.gte = new Date(query.from);
      }

      if (query.to) {
        createdAt.lte = new Date(query.to);
      }

      where.createdAt = createdAt;
    }

    const requestedTake = query.take === undefined ? 100 : Number.parseInt(query.take, 10);

    const take = Math.max(1, Math.min(requestedTake, 200));

    return this.prisma.auditLog.findMany({
      where,
      take,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        organizationId: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        actorUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });
  }

  private async setRoleTemplateStatus(
    context: AuthContext,
    roleTemplateId: string,
    isActive: boolean,
  ) {
    this.assertSuperAdmin(context);

    const template = await this.prisma.adminRoleTemplate.findUnique({
      where: {
        id: roleTemplateId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
        message: "Administrative role template not found.",
      });
    }

    if (template.isActive === isActive) {
      throw new ConflictException({
        code: isActive
          ? "ADMIN_ROLE_TEMPLATE_ALREADY_ACTIVE"
          : "ADMIN_ROLE_TEMPLATE_ALREADY_INACTIVE",
        message: isActive
          ? "Administrative role template is already active."
          : "Administrative role template is already inactive.",
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.adminRoleTemplate.update({
        where: {
          id: template.id,
        },
        data: {
          isActive,
        },
        select: {
          id: true,
          code: true,
          name: true,
          isSystem: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: isActive ? "admin.role_template.activated" : "admin.role_template.deactivated",
          entityType: "AdminRoleTemplate",
          entityId: template.id,
          metadata: {
            code: template.code,
            previousActive: template.isActive,
            newActive: isActive,
          },
        },
      });

      return updated;
    });
  }

  private normalizePermissionCodes(input: string[]): string[] {
    return [...new Set(input.map((code) => code.trim().toLowerCase()))].sort();
  }

  private async requirePermissions(
    transaction: Prisma.TransactionClient,
    permissionCodes: string[],
  ) {
    const permissions = await transaction.adminPermission.findMany({
      where: {
        code: {
          in: permissionCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (permissions.length !== permissionCodes.length) {
      const existing = new Set(permissions.map((permission) => permission.code));

      const missing = permissionCodes.filter((code) => !existing.has(code));

      throw new NotFoundException({
        code: "ADMIN_PERMISSION_NOT_FOUND",
        message: "One or more administrative permissions do not exist.",
        missing,
      });
    }

    return permissions;
  }

  private assertSuperAdmin(context: AuthContext): void {
    if (context.role !== MembershipRole.SUPER_ADMIN || context.organizationId !== null) {
      throw new ForbiddenException({
        code: "SUPER_ADMIN_REQUIRED",
        message: "Platform Super Admin authorization is required.",
      });
    }
  }
}
