import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MembershipRole, Prisma, type PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import type { RequestContext } from "@edumall/shared-types";
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
    this.assertDelegatedPermissionSubset(context, permissionCodes);

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

    this.assertCustomTemplate(current);

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
    this.assertDelegatedPermissionSubset(context, permissionCodes);

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
          isSystem: true,
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

      this.assertCustomTemplate(template);

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

  public async listAuditLogs(
    context: AuthContext,
    query: AdminAuditQueryDto,
    requestContext?: RequestContext,
  ) {
    this.assertSuperAdmin(context);

    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    if (query.subjectUserId) where.subjectUserId = query.subjectUserId;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.outcome) where.outcome = query.outcome;
    if (query.purpose?.trim()) {
      where.purpose = { contains: query.purpose.trim(), mode: "insensitive" };
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

    const requestedLimit = Number.parseInt(query.limit ?? query.take ?? "100", 10);
    const limit = Math.max(1, Math.min(requestedLimit, 200));
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;

    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ];
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        organizationId: true,
        actorUserId: true,
        subjectUserId: true,
        requestId: true,
        correlationId: true,
        purpose: true,
        outcome: true,
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

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const last = items.at(-1);

    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.audit.searched",
          entityType: "AuditLog",
          requestId: requestContext?.requestId ?? null,
          correlationId: requestContext?.correlationId ?? null,
          purpose: query.purpose?.trim() || "administrative_audit_review",
          metadata: {
            authorizedScope: "PLATFORM",
            filters: {
              actorUserId: query.actorUserId ?? null,
              subjectUserId: query.subjectUserId ?? null,
              organizationId: query.organizationId ?? null,
              action: query.action?.trim() || null,
              entityType: query.entityType?.trim() || null,
              entityId: query.entityId ?? null,
              outcome: query.outcome ?? null,
              from: query.from ?? null,
              to: query.to ?? null,
            },
            resultCount: items.length,
          },
        },
      });
    } catch {
      throw new ServiceUnavailableException({
        code: "MANDATORY_AUDIT_UNAVAILABLE",
        message: "Privileged audit evidence could not be persisted.",
      });
    }

    return {
      items,
      hasNext,
      nextCursor: hasNext && last ? this.encodeCursor(last.createdAt, last.id) : null,
    };
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
        isSystem: true,
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
        message: "Administrative role template not found.",
      });
    }

    this.assertCustomTemplate(template);

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

  private assertCustomTemplate(template: { isSystem: boolean }): void {
    if (template.isSystem) {
      throw new ForbiddenException({
        code: "SYSTEM_ROLE_TEMPLATE_PROTECTED",
        message: "Protected system role templates cannot be modified.",
      });
    }
  }

  private assertDelegatedPermissionSubset(context: AuthContext, permissionCodes: string[]): void {
    if (context.role === MembershipRole.SUPER_ADMIN && context.organizationId === null) return;

    const effective = new Set(context.permissions ?? []);
    const unauthorized = permissionCodes.filter((code) => !effective.has(code));
    if (unauthorized.length > 0) {
      throw new ForbiddenException({
        code: "ADMIN_PERMISSION_ESCALATION_DENIED",
        message: "Delegated administrators cannot grant permissions they do not hold.",
        unauthorized,
      });
    }
  }

  private encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), "utf8").toString(
      "base64url",
    );
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
        createdAt?: unknown;
        id?: unknown;
      };
      const createdAt = new Date(String(parsed.createdAt));
      if (
        typeof parsed.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          parsed.id,
        ) ||
        !Number.isFinite(createdAt.getTime())
      )
        throw new Error();
      return { createdAt, id: parsed.id };
    } catch {
      throw new BadRequestException({
        code: "INVALID_AUDIT_CURSOR",
        message: "Audit cursor is invalid.",
      });
    }
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
    if (
      (context.role !== MembershipRole.SUPER_ADMIN &&
        context.role !== MembershipRole.PLATFORM_ADMIN) ||
      context.organizationId !== null
    ) {
      throw new ForbiddenException({
        code: "SUPER_ADMIN_REQUIRED",
        message: "Platform Super Admin authorization is required.",
      });
    }
  }
}
