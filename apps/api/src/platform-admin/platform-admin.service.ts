import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AdminProfileStatus,
  AdminScopeType,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  NotificationChannel,
  NotificationDeliveryStatus,
  OutboxEventStatus,
  Prisma,
  type PrismaClient,
  UserStatus,
} from "@prisma/client";
import { hashOpaqueToken, normalizeEmail } from "@edumall/database";
import { randomBytes } from "node:crypto";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { boundedLimit, decodeCreatedCursor, pageResult } from "./platform-admin-pagination";
import type {
  AdminDirectoryQueryDto,
  AssignAdminRoleDto,
  CreatePlatformAdminDto,
  CursorQueryDto,
  RoleTemplateQueryDto,
  UpdatePlatformAdminDto,
} from "./platform-admin.types";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listAdmins(context: AuthContext, query: AdminDirectoryQueryDto = {}) {
    this.assertSuperAdmin(context);
    const limit = boundedLimit(query.limit);
    const cursor = decodeCreatedCursor(query.cursor);
    const search = query.search?.trim();
    const result = await this.prisma.adminProfile.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.scopeType || query.organizationId
          ? {
              assignments: {
                some: {
                  revokedAt: null,
                  ...(query.scopeType ? { scopeType: query.scopeType } : {}),
                  ...(query.organizationId ? { organizationId: query.organizationId } : {}),
                },
              },
            }
          : {}),
        AND: [
          ...(search
            ? [
                {
                  OR: [
                    { title: { contains: search, mode: "insensitive" as const } },
                    { responsibility: { contains: search, mode: "insensitive" as const } },
                    {
                      user: {
                        OR: [
                          { email: { contains: search, mode: "insensitive" as const } },
                          { firstName: { contains: search, mode: "insensitive" as const } },
                          { lastName: { contains: search, mode: "insensitive" as const } },
                        ],
                      },
                    },
                  ],
                },
              ]
            : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        status: true,
        title: true,
        responsibility: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            lastLoginAt: true,
            invitationTokens: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                expiresAt: true,
                usedAt: true,
                revokedAt: true,
                createdAt: true,
                deliveries: {
                  take: 1,
                  orderBy: { requestedAt: "desc" },
                  select: {
                    id: true,
                    status: true,
                    failureCode: true,
                    requestedAt: true,
                    sentAt: true,
                  },
                },
              },
            },
          },
        },
        assignments: {
          where: {
            revokedAt: null,
          },
          take: 100,
          orderBy: {
            grantedAt: "desc",
          },
          select: {
            id: true,
            scopeType: true,
            organizationId: true,
            grantedAt: true,
            roleTemplate: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                permissions: {
                  take: 100,
                  orderBy: { permission: { code: "asc" } },
                  select: { permission: { select: { code: true } } },
                },
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
        },
      },
    });
    await this.recordSensitiveRead(
      context,
      "admin.directory.viewed",
      "AdminProfile",
      Math.min(result.length, limit),
    );
    const page = pageResult(result, limit);
    return {
      ...page,
      items: page.items.map((admin) => ({
        ...admin,
        user: { ...admin.user, invitationTokens: undefined },
        effectivePermissions: [
          ...new Set(
            admin.assignments
              .filter((assignment) => assignment.roleTemplate.isActive)
              .flatMap((assignment) =>
                assignment.roleTemplate.permissions.map((link) => link.permission.code),
              ),
          ),
        ].sort(),
        invitation: this.projectInvitation(admin.user.invitationTokens[0]),
      })),
    };
  }

  public async getAdmin(context: AuthContext, id: string) {
    this.assertSuperAdmin(context);
    const result = await this.prisma.adminProfile.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        title: true,
        responsibility: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            emailVerifiedAt: true,
            lastLoginAt: true,
            invitationTokens: {
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                expiresAt: true,
                usedAt: true,
                revokedAt: true,
                createdAt: true,
                deliveries: {
                  select: {
                    id: true,
                    status: true,
                    failureCode: true,
                    requestedAt: true,
                    sentAt: true,
                    cancelledAt: true,
                  },
                },
              },
            },
          },
        },
        assignments: {
          take: 200,
          orderBy: { grantedAt: "desc" },
          select: {
            id: true,
            scopeType: true,
            organizationId: true,
            grantedAt: true,
            revokedAt: true,
            roleTemplate: {
              select: {
                id: true,
                code: true,
                name: true,
                isSystem: true,
                isActive: true,
                permissions: {
                  take: 100,
                  orderBy: { permission: { code: "asc" } },
                  select: { permission: { select: { code: true, module: true, action: true } } },
                },
              },
            },
            organization: {
              select: { id: true, name: true, slug: true, type: true, status: true },
            },
          },
        },
      },
    });
    if (!result)
      throw new NotFoundException({
        code: "ADMIN_PROFILE_NOT_FOUND",
        message: "Administrator profile not found.",
      });
    await this.recordSensitiveRead(context, "admin.detail.viewed", "AdminProfile", 1);
    return {
      ...result,
      user: {
        ...result.user,
        invitationTokens: result.user.invitationTokens.map((invitation) =>
          this.projectInvitation(invitation),
        ),
      },
      effectivePermissions: [
        ...new Set(
          result.assignments
            .filter((a) => !a.revokedAt && a.roleTemplate.isActive)
            .flatMap((a) => a.roleTemplate.permissions.map((link) => link.permission.code)),
        ),
      ].sort(),
    };
  }

  public async listRoleTemplates(context: AuthContext, query: RoleTemplateQueryDto = {}) {
    this.assertSuperAdmin(context);
    const limit = boundedLimit(query.limit);
    const cursor = decodeCreatedCursor(query.cursor);
    const search = query.search?.trim();
    const result = await this.prisma.adminRoleTemplate.findMany({
      where: {
        ...(query.isActive ? { isActive: query.isActive === "true" } : {}),
        ...(query.isSystem ? { isSystem: query.isSystem === "true" } : {}),
        AND: [
          ...(search
            ? [
                {
                  OR: [
                    { code: { contains: search.toUpperCase() } },
                    { name: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              ]
            : []),
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        _count: { select: { assignments: { where: { revokedAt: null } } } },
        permissions: {
          take: 100,
          orderBy: { permission: { code: "asc" } },
          select: {
            permission: {
              select: {
                code: true,
                module: true,
                action: true,
                description: true,
              },
            },
          },
        },
      },
    });
    await this.recordSensitiveRead(
      context,
      "admin.role_templates.viewed",
      "AdminRoleTemplate",
      Math.min(result.length, limit),
    );
    return pageResult(result, limit);
  }

  public async listPermissions(context: AuthContext, query: CursorQueryDto = {}) {
    this.assertSuperAdmin(context);
    const limit = boundedLimit(query.limit, 100);
    const cursor = decodeCreatedCursor(query.cursor);
    const filters: Prisma.AdminPermissionWhereInput[] = [];
    if (context.role !== MembershipRole.SUPER_ADMIN)
      filters.push({ code: { in: context.permissions ?? [] } });
    if (cursor)
      filters.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    const result = await this.prisma.adminPermission.findMany({
      where: filters.length ? { AND: filters } : {},
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    await this.recordSensitiveRead(
      context,
      "admin.permissions.viewed",
      "AdminPermission",
      Math.min(result.length, limit),
    );
    return pageResult(result, limit);
  }

  public async createAdmin(context: AuthContext, input: CreatePlatformAdminDto) {
    this.assertSuperAdmin(context);

    const normalizedEmail = normalizeEmail(input.email);
    const roleCode = input.roleTemplateCode.trim().toUpperCase();

    const organizationIds = input.organizationIds ?? [];

    this.assertScopeInput(input.scopeType, organizationIds);

    const result = await this.prisma.$transaction(async (transaction) => {
      const roleTemplate = await transaction.adminRoleTemplate.findUnique({
        where: {
          code: roleCode,
        },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      });

      if (!roleTemplate || !roleTemplate.isActive) {
        throw new NotFoundException({
          code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
          message: "Administrative role template not found.",
        });
      }
      this.assertCanGrantRole(
        context,
        roleTemplate.permissions.map((link) => link.permission.code),
      );

      let user = await transaction.user.findUnique({
        where: {
          normalizedEmail,
        },
      });

      let invitation: {
        id: string;
        expiresAt: Date;
        deliveryStatus: NotificationDeliveryStatus;
      } | null = null;

      if (user) {
        if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.INVITED) {
          throw new ConflictException({
            code: "ADMIN_USER_NOT_ELIGIBLE",
            message: "This user cannot currently be appointed as an administrator.",
          });
        }
      } else {
        user = await transaction.user.create({
          data: {
            email: input.email.trim(),
            normalizedEmail,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            status: UserStatus.INVITED,
          },
        });
      }

      const existingProfile = await transaction.adminProfile.findUnique({
        where: {
          userId: user.id,
        },
      });

      if (existingProfile) {
        throw new ConflictException({
          code: "ADMIN_PROFILE_EXISTS",
          message: "This user already has an administrative profile.",
        });
      }

      const profile = await transaction.adminProfile.create({
        data: {
          userId: user.id,
          title: input.title?.trim() || null,
          responsibility: input.responsibility?.trim() || roleTemplate.name,
          createdByUserId: context.userId,
        },
      });

      const scopes = await this.prepareScopes(
        transaction,
        user.id,
        input.scopeType,
        organizationIds,
      );

      const assignmentIds: string[] = [];

      for (const scope of scopes) {
        const assignment = await transaction.adminRoleAssignment.create({
          data: {
            adminProfileId: profile.id,
            roleTemplateId: roleTemplate.id,
            scopeType: input.scopeType,
            organizationId: scope.organizationId,
            grantedByUserId: context.userId,
          },
          select: {
            id: true,
          },
        });

        assignmentIds.push(assignment.id);
      }

      if (user.status === UserStatus.INVITED) {
        invitation = await this.issueInvitation(transaction, user.id, user.email, profile.id);
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.created",
          entityType: "AdminProfile",
          entityId: profile.id,
          metadata: {
            userId: user.id,
            email: user.email,
            roleTemplateCode: roleTemplate.code,
            scopeType: input.scopeType,
            organizationIds,
            assignmentIds,
          },
        },
      });

      return {
        profileId: profile.id,
        userId: user.id,
        email: user.email,
        roleTemplate: roleTemplate.code,
        scopeType: input.scopeType,
        organizationIds,
        invitation,
      };
    });

    return result;
  }

  public async assignRole(context: AuthContext, adminProfileId: string, input: AssignAdminRoleDto) {
    this.assertSuperAdmin(context);

    const roleCode = input.roleTemplateCode.trim().toUpperCase();

    const organizationIds = input.organizationIds ?? [];

    this.assertScopeInput(input.scopeType, organizationIds);

    return this.prisma.$transaction(async (transaction) => {
      const profile = await transaction.adminProfile.findUnique({
        where: {
          id: adminProfileId,
        },
        select: {
          id: true,
          userId: true,
          status: true,
        },
      });

      if (!profile) {
        throw new NotFoundException({
          code: "ADMIN_PROFILE_NOT_FOUND",
          message: "Administrator profile not found.",
        });
      }

      if (profile.status !== AdminProfileStatus.ACTIVE) {
        throw new ConflictException({
          code: "ADMIN_PROFILE_NOT_ACTIVE",
          message: "Administrator must be active before assigning responsibilities.",
        });
      }

      const roleTemplate = await transaction.adminRoleTemplate.findUnique({
        where: {
          code: roleCode,
        },
        select: {
          id: true,
          code: true,
          isActive: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      });

      if (!roleTemplate || !roleTemplate.isActive) {
        throw new NotFoundException({
          code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
          message: "Administrative role template not found.",
        });
      }
      this.assertCanGrantRole(
        context,
        roleTemplate.permissions.map((link) => link.permission.code),
      );

      const scopes = await this.prepareScopes(
        transaction,
        profile.userId,
        input.scopeType,
        organizationIds,
      );

      const created: string[] = [];

      for (const scope of scopes) {
        const existing = await transaction.adminRoleAssignment.findFirst({
          where: {
            adminProfileId: profile.id,
            roleTemplateId: roleTemplate.id,
            scopeType: input.scopeType,
            organizationId: scope.organizationId,
            revokedAt: null,
          },
          select: {
            id: true,
          },
        });

        if (existing) {
          throw new ConflictException({
            code: "ADMIN_ASSIGNMENT_EXISTS",
            message:
              "This administrative responsibility is already assigned for the selected scope.",
          });
        }

        const assignment = await transaction.adminRoleAssignment.create({
          data: {
            adminProfileId: profile.id,
            roleTemplateId: roleTemplate.id,
            scopeType: input.scopeType,
            organizationId: scope.organizationId,
            grantedByUserId: context.userId,
          },
          select: {
            id: true,
          },
        });

        created.push(assignment.id);
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.role_assigned",
          entityType: "AdminProfile",
          entityId: profile.id,
          metadata: {
            roleTemplateCode: roleTemplate.code,
            scopeType: input.scopeType,
            organizationIds,
            assignmentIds: created,
          },
        },
      });

      return {
        adminProfileId: profile.id,
        roleTemplateCode: roleTemplate.code,
        assignmentIds: created,
      };
    });
  }

  public async updateAdmin(
    context: AuthContext,
    adminProfileId: string,
    input: UpdatePlatformAdminDto,
  ) {
    this.assertSuperAdmin(context);
    const current = await this.prisma.adminProfile.findUnique({
      where: { id: adminProfileId },
      select: { id: true, title: true, responsibility: true },
    });
    if (!current)
      throw new NotFoundException({
        code: "ADMIN_PROFILE_NOT_FOUND",
        message: "Administrator profile not found.",
      });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.adminProfile.update({
        where: { id: adminProfileId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() || null } : {}),
          ...(input.responsibility !== undefined
            ? { responsibility: input.responsibility.trim() || null }
            : {}),
        },
        select: { id: true, title: true, responsibility: true, status: true, updatedAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.profile.updated",
          entityType: "AdminProfile",
          entityId: adminProfileId,
          metadata: { changedFields: Object.keys(input).sort() },
        },
      });
      return updated;
    });
  }

  public async resendInvitation(context: AuthContext, adminProfileId: string) {
    this.assertSuperAdmin(context);
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.adminProfile.findUnique({
        where: { id: adminProfileId },
        select: { id: true, user: { select: { id: true, email: true, status: true } } },
      });
      if (!profile)
        throw new NotFoundException({
          code: "ADMIN_PROFILE_NOT_FOUND",
          message: "Administrator profile not found.",
        });
      if (profile.user.status !== UserStatus.INVITED)
        throw new ConflictException({
          code: "ADMIN_INVITATION_NOT_APPLICABLE",
          message: "Only invited administrators can be resent an invitation.",
        });
      const invitation = await this.issueInvitation(
        tx,
        profile.user.id,
        profile.user.email,
        profile.id,
      );
      await tx.auditLog.create({
        data: {
          actorUserId: context.userId,
          subjectUserId: profile.user.id,
          action: "admin.invitation.resent",
          entityType: "AdminProfile",
          entityId: profile.id,
          metadata: { invitationTokenId: invitation.id, deliveryStatus: invitation.deliveryStatus },
        },
      });
      return invitation;
    });
  }

  public async revokeInvitation(context: AuthContext, adminProfileId: string) {
    this.assertSuperAdmin(context);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.adminProfile.findUnique({
        where: { id: adminProfileId },
        select: { id: true, userId: true },
      });
      if (!profile)
        throw new NotFoundException({
          code: "ADMIN_PROFILE_NOT_FOUND",
          message: "Administrator profile not found.",
        });
      const tokens = await tx.invitationToken.findMany({
        where: { userId: profile.userId, usedAt: null, revokedAt: null },
        select: { id: true },
      });
      if (tokens.length === 0)
        throw new ConflictException({
          code: "ACTIVE_INVITATION_NOT_FOUND",
          message: "No active invitation exists.",
        });
      const tokenIds = tokens.map((token) => token.id);
      await tx.invitationToken.updateMany({
        where: { id: { in: tokenIds } },
        data: { revokedAt: now },
      });
      await tx.notificationDelivery.updateMany({
        where: {
          invitationTokenId: { in: tokenIds },
          status: {
            in: [
              NotificationDeliveryStatus.PENDING,
              NotificationDeliveryStatus.BLOCKED_CONFIGURATION,
            ],
          },
        },
        data: { status: NotificationDeliveryStatus.CANCELLED, cancelledAt: now },
      });
      await tx.outboxEvent.updateMany({
        where: {
          aggregateId: profile.id,
          eventType: "admin.invitation.delivery.requested",
          status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.BLOCKED_CONFIGURATION] },
        },
        data: { status: OutboxEventStatus.CANCELLED, processedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: context.userId,
          subjectUserId: profile.userId,
          action: "admin.invitation.revoked",
          entityType: "AdminProfile",
          entityId: profile.id,
          metadata: { invitationTokenIds: tokenIds },
        },
      });
      return { adminProfileId, revokedAt: now, invitationCount: tokenIds.length };
    });
  }

  public async revokeAssignment(context: AuthContext, assignmentId: string) {
    this.assertSuperAdmin(context);

    const assignment = await this.prisma.adminRoleAssignment.findUnique({
      where: {
        id: assignmentId,
      },
      select: {
        id: true,
        adminProfileId: true,
        revokedAt: true,
        roleTemplate: {
          select: {
            code: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException({
        code: "ADMIN_ASSIGNMENT_NOT_FOUND",
        message: "Administrative assignment not found.",
      });
    }

    if (assignment.revokedAt) {
      throw new ConflictException({
        code: "ADMIN_ASSIGNMENT_ALREADY_REVOKED",
        message: "Administrative assignment is already revoked.",
      });
    }

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.adminRoleAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          revokedAt: now,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: "admin.role_revoked",
          entityType: "AdminProfile",
          entityId: assignment.adminProfileId,
          metadata: {
            assignmentId: assignment.id,
            roleTemplateCode: assignment.roleTemplate.code,
          },
        },
      });
    });

    return {
      assignmentId,
      revokedAt: now,
    };
  }

  public suspendAdmin(context: AuthContext, adminProfileId: string) {
    return this.setAdminStatus(context, adminProfileId, AdminProfileStatus.SUSPENDED);
  }

  public reactivateAdmin(context: AuthContext, adminProfileId: string) {
    return this.setAdminStatus(context, adminProfileId, AdminProfileStatus.ACTIVE);
  }

  private async setAdminStatus(
    context: AuthContext,
    adminProfileId: string,
    status: AdminProfileStatus,
  ) {
    this.assertSuperAdmin(context);

    const profile = await this.prisma.adminProfile.findUnique({
      where: {
        id: adminProfileId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: "ADMIN_PROFILE_NOT_FOUND",
        message: "Administrator profile not found.",
      });
    }

    if (profile.userId === context.userId) {
      throw new ForbiddenException({
        code: "SUPER_ADMIN_SELF_PROTECTION",
        message: "You cannot suspend your own administrative access.",
      });
    }

    const now = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.adminProfile.update({
        where: {
          id: profile.id,
        },
        data: {
          status,
          suspendedAt: status === AdminProfileStatus.SUSPENDED ? now : null,
        },
        select: {
          id: true,
          userId: true,
          status: true,
          suspendedAt: true,
          updatedAt: true,
        },
      });

      if (status === AdminProfileStatus.SUSPENDED) {
        await transaction.session.updateMany({
          where: {
            adminProfileId: profile.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: context.userId,
          action: status === AdminProfileStatus.SUSPENDED ? "admin.suspended" : "admin.reactivated",
          entityType: "AdminProfile",
          entityId: profile.id,
          metadata: {
            userId: profile.userId,
            previousStatus: profile.status,
            newStatus: status,
            revokedPrivilegeSessionsOnly: true,
          },
        },
      });

      return updated;
    });
  }

  private async prepareScopes(
    transaction: Prisma.TransactionClient,
    userId: string,
    scopeType: AdminScopeType,
    organizationIds: string[],
  ): Promise<{ organizationId: string | null }[]> {
    if (scopeType === AdminScopeType.PLATFORM) {
      const platform = await transaction.organization.findFirst({
        where: {
          type: OrganizationType.PLATFORM,
          status: OrganizationStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      if (!platform) {
        throw new ConflictException({
          code: "PLATFORM_ORGANIZATION_NOT_FOUND",
          message: "Active platform organization is not configured.",
        });
      }

      await this.ensureAdminMembership(transaction, userId, platform.id);

      return [
        {
          organizationId: null,
        },
      ];
    }

    const organizations = await transaction.organization.findMany({
      where: {
        id: {
          in: organizationIds,
        },
        status: OrganizationStatus.ACTIVE,
        type: {
          not: OrganizationType.PLATFORM,
        },
      },
      select: {
        id: true,
      },
    });

    if (organizations.length !== new Set(organizationIds).size) {
      throw new NotFoundException({
        code: "ADMIN_SCOPE_ORGANIZATION_NOT_FOUND",
        message: "One or more selected organizations are unavailable.",
      });
    }

    for (const organization of organizations) {
      await this.ensureAdminMembership(transaction, userId, organization.id);
    }

    return organizations.map((organization) => ({
      organizationId: organization.id,
    }));
  }

  private async issueInvitation(
    transaction: Prisma.TransactionClient,
    userId: string,
    email: string,
    adminProfileId: string,
  ): Promise<{ id: string; expiresAt: Date; deliveryStatus: NotificationDeliveryStatus }> {
    const now = new Date();
    await transaction.invitationToken.updateMany({
      where: { userId, usedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const token = await transaction.invitationToken.create({
      data: { userId, tokenHash: hashOpaqueToken(rawToken), expiresAt },
      select: { id: true, expiresAt: true },
    });
    const deliveryStatus = NotificationDeliveryStatus.BLOCKED_CONFIGURATION;
    await transaction.notificationDelivery.create({
      data: {
        userId,
        invitationTokenId: token.id,
        channel: NotificationChannel.EMAIL,
        templateCode: "ADMIN_INVITATION",
        destination: email,
        status: deliveryStatus,
        failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
      },
    });
    await transaction.outboxEvent.create({
      data: {
        eventType: "admin.invitation.delivery.requested",
        aggregateType: "AdminProfile",
        aggregateId: adminProfileId,
        idempotencyKey: `admin-invitation:${token.id}`,
        status: OutboxEventStatus.BLOCKED_CONFIGURATION,
        lastErrorCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
        payload: {
          adminProfileId,
          userId,
          invitationTokenId: token.id,
          channel: "EMAIL",
          templateCode: "ADMIN_INVITATION",
        },
      },
    });
    return { id: token.id, expiresAt: token.expiresAt, deliveryStatus };
  }

  private projectInvitation<
    T extends { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  >(invitation?: T): (T & { lifecycleStatus: string }) | null {
    if (!invitation) return null;
    const lifecycleStatus = invitation.usedAt
      ? "ACCEPTED"
      : invitation.revokedAt
        ? "REVOKED"
        : invitation.expiresAt <= new Date()
          ? "EXPIRED"
          : "PENDING";
    return { ...invitation, lifecycleStatus };
  }

  private async ensureAdminMembership(
    transaction: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const existing = await transaction.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (existing && existing.role !== MembershipRole.PLATFORM_ADMIN) {
      throw new ConflictException({
        code: "ADMIN_MEMBERSHIP_ROLE_CONFLICT",
        message: "The user already has a different role in the selected organization.",
      });
    }

    if (existing) {
      await transaction.organizationMembership.update({
        where: {
          id: existing.id,
        },
        data: {
          role: MembershipRole.PLATFORM_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      return;
    }

    await transaction.organizationMembership.create({
      data: {
        organizationId,
        userId,
        role: MembershipRole.PLATFORM_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
  }

  private assertScopeInput(scopeType: AdminScopeType, organizationIds: string[]): void {
    if (scopeType === AdminScopeType.PLATFORM && organizationIds.length > 0) {
      throw new ConflictException({
        code: "INVALID_ADMIN_SCOPE",
        message: "Platform scope must not contain organization IDs.",
      });
    }

    if (scopeType === AdminScopeType.ORGANIZATION && organizationIds.length === 0) {
      throw new ConflictException({
        code: "INVALID_ADMIN_SCOPE",
        message: "Organization scope requires at least one organization.",
      });
    }
  }

  private async recordSensitiveRead(
    context: AuthContext,
    action: string,
    entityType: string,
    resultCount: number,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: context.userId,
          action,
          entityType,
          purpose: "administrative_access_management",
          metadata: { authorizedScope: "PLATFORM", resultCount },
        },
      });
    } catch {
      throw new ServiceUnavailableException({
        code: "MANDATORY_AUDIT_UNAVAILABLE",
        message: "Privileged audit evidence could not be persisted.",
      });
    }
  }

  private assertCanGrantRole(context: AuthContext, permissionCodes: string[]): void {
    if (context.role === MembershipRole.SUPER_ADMIN && context.organizationId === null) return;

    const effective = new Set(context.permissions ?? []);
    const unauthorized = permissionCodes.filter((code) => !effective.has(code));
    if (unauthorized.length > 0) {
      throw new ForbiddenException({
        code: "ADMIN_PERMISSION_ESCALATION_DENIED",
        message: "Delegated administrators cannot assign permissions they do not hold.",
        unauthorized,
      });
    }
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
