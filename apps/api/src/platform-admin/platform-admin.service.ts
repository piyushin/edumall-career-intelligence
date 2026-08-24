import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdminProfileStatus,
  AdminScopeType,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  Prisma,
  type PrismaClient,
  UserStatus,
} from "@prisma/client";
import { hashOpaqueToken, normalizeEmail } from "@edumall/database";
import { randomBytes } from "node:crypto";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { AssignAdminRoleDto, CreatePlatformAdminDto } from "./platform-admin.types";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public listAdmins(context: AuthContext) {
    this.assertSuperAdmin(context);

    return this.prisma.adminProfile.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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
          },
        },
        assignments: {
          where: {
            revokedAt: null,
          },
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
  }

  public listRoleTemplates(context: AuthContext) {
    this.assertSuperAdmin(context);

    return this.prisma.adminRoleTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
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
  }

  public listPermissions(context: AuthContext) {
    this.assertSuperAdmin(context);

    return this.prisma.adminPermission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });
  }

  public async createAdmin(context: AuthContext, input: CreatePlatformAdminDto) {
    this.assertSuperAdmin(context);

    const normalizedEmail = normalizeEmail(input.email);
    const roleCode = input.roleTemplateCode.trim().toUpperCase();

    const rawInvitationToken = randomBytes(32).toString("base64url");

    const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);

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
        },
      });

      if (!roleTemplate || !roleTemplate.isActive) {
        throw new NotFoundException({
          code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
          message: "Administrative role template not found.",
        });
      }

      let user = await transaction.user.findUnique({
        where: {
          normalizedEmail,
        },
      });

      let invitationToken: string | null = null;

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
        await transaction.invitationToken.deleteMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
        });

        await transaction.invitationToken.create({
          data: {
            userId: user.id,
            tokenHash: hashOpaqueToken(rawInvitationToken),
            expiresAt: invitationExpiresAt,
          },
        });

        invitationToken = rawInvitationToken;
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
        invitationToken,
        invitationExpiresAt: invitationToken ? invitationExpiresAt : null,
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
        },
      });

      if (!roleTemplate || !roleTemplate.isActive) {
        throw new NotFoundException({
          code: "ADMIN_ROLE_TEMPLATE_NOT_FOUND",
          message: "Administrative role template not found.",
        });
      }

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
            userId: profile.userId,
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

  private assertSuperAdmin(context: AuthContext): void {
    if (context.role !== MembershipRole.SUPER_ADMIN || context.organizationId !== null) {
      throw new ForbiddenException({
        code: "SUPER_ADMIN_REQUIRED",
        message: "Platform Super Admin authorization is required.",
      });
    }
  }
}
