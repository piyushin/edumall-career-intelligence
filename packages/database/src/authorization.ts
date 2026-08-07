import {
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

    return { user, organization, membership, role: membership.role };
  } catch (error) {
    throw asAuthenticationError(error);
  }
}

export interface PlatformAuthorizationContext {
  user: User;
  membership: OrganizationMembership;
  role: MembershipRole;
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
        role: MembershipRole.SUPER_ADMIN,
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

    return { user, membership, role: MembershipRole.SUPER_ADMIN };
  } catch (error) {
    throw asAuthenticationError(error);
  }
}
