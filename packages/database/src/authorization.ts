import {
  AdminProfileStatus,
  AdminScopeType,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  type Organization,
  type OrganizationMembership,
  type PrismaClient,
  type User,
  UserStatus,
} from "@prisma/client";
import { asAuthenticationError, AuthenticationError, AuthenticationErrorCode } from "./auth-errors";

export interface OrganizationAuthorizationContext {
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
  role: MembershipRole;
  adminProfileId: string | null;
}

export async function requireActiveOrganizationMembership(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<OrganizationAuthorizationContext> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError(AuthenticationErrorCode.INACTIVE_USER);
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });

    if (!organization) {
      throw new AuthenticationError(AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS);
    }

    if (organization.status !== OrganizationStatus.ACTIVE) {
      throw new AuthenticationError(AuthenticationErrorCode.INACTIVE_ORGANIZATION);
    }

    const membership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });

    if (!membership) {
      throw new AuthenticationError(AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS);
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new AuthenticationError(AuthenticationErrorCode.INACTIVE_MEMBERSHIP);
    }

    let adminProfileId: string | null = null;

    if (membership.role === MembershipRole.PLATFORM_ADMIN) {
      const profile = await prisma.adminProfile.findUnique({
        where: { userId },
        select: { id: true, status: true },
      });

      if (!profile || profile.status !== AdminProfileStatus.ACTIVE) {
        throw new AuthenticationError(AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS);
      }

      adminProfileId = profile.id;
    }

    return { user, organization, membership, role: membership.role, adminProfileId };
  } catch (error) {
    throw asAuthenticationError(error);
  }
}

export async function resolveEffectiveAdminPermissions(
  prisma: PrismaClient,
  userId: string,
  organizationId: string | null,
): Promise<string[]> {
  const profile = await prisma.adminProfile.findUnique({
    where: { userId },
    select: {
      status: true,
      assignments: {
        where: {
          revokedAt: null,
          roleTemplate: {
            isActive: true,
          },
          OR:
            organizationId === null
              ? [{ scopeType: AdminScopeType.PLATFORM }]
              : [
                  { scopeType: AdminScopeType.PLATFORM },
                  {
                    scopeType: AdminScopeType.ORGANIZATION,
                    organizationId,
                  },
                ],
        },
        select: {
          roleTemplate: {
            select: {
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
          },
        },
      },
    },
  });

  if (!profile || profile.status !== AdminProfileStatus.ACTIVE) {
    return [];
  }

  const permissions = new Set<string>();

  for (const assignment of profile.assignments) {
    for (const link of assignment.roleTemplate.permissions) {
      permissions.add(link.permission.code);
    }
  }

  return [...permissions].sort();
}

export interface PlatformAuthorizationContext {
  user: User;
  membership: OrganizationMembership;
  role: MembershipRole;
  adminProfileId: string | null;
}

export async function requirePlatformAuthorization(
  prisma: PrismaClient,
  userId: string,
): Promise<PlatformAuthorizationContext> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError(AuthenticationErrorCode.INACTIVE_USER);
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId,
        role: {
          in: [MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN],
        },
        status: MembershipStatus.ACTIVE,
        organization: {
          status: OrganizationStatus.ACTIVE,
          type: OrganizationType.PLATFORM,
        },
      },
    });

    if (!membership) {
      throw new AuthenticationError(AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS);
    }

    let adminProfileId: string | null = null;

    if (membership.role === MembershipRole.PLATFORM_ADMIN) {
      const profile = await prisma.adminProfile.findUnique({
        where: { userId },
        select: { id: true, status: true },
      });

      if (!profile || profile.status !== AdminProfileStatus.ACTIVE) {
        throw new AuthenticationError(AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS);
      }

      adminProfileId = profile.id;
    }

    return { user, membership, role: membership.role, adminProfileId };
  } catch (error) {
    throw asAuthenticationError(error);
  }
}
