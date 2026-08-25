import {
  SessionPrivilegeType,
  SessionScope,
  type MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import { asAuthenticationError, AuthenticationError, AuthenticationErrorCode } from "./auth-errors";
import {
  requireActiveOrganizationMembership,
  requirePlatformAuthorization,
  resolveEffectiveAdminPermissions,
} from "./authorization";
import { hashOpaqueToken } from "./tokens";

export interface AuthContext {
  userId: string;
  organizationId: string | null;
  membershipId: string | null;
  role: MembershipRole;
  sessionId: string;
  permissions?: string[];
  adminProfileId?: string | null;
  privilegeType?: SessionPrivilegeType;
}

export interface SessionValidationOptions {
  now?: Date;
}

export async function validateSessionToken(
  prisma: PrismaClient,
  rawToken: string,
  options: SessionValidationOptions = {},
): Promise<AuthContext> {
  try {
    const now = options.now ?? new Date();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashOpaqueToken(rawToken) },
    });

    if (!session || session.revokedAt) {
      throw new AuthenticationError(AuthenticationErrorCode.INVALID_SESSION);
    }

    if (session.expiresAt <= now) {
      throw new AuthenticationError(AuthenticationErrorCode.EXPIRED_SESSION);
    }

    if (session.scope === SessionScope.ORGANIZATION) {
      if (!session.organizationId) {
        throw new AuthenticationError(AuthenticationErrorCode.INVALID_SESSION);
      }

      const authorization = await requireActiveOrganizationMembership(
        prisma,
        session.userId,
        session.organizationId,
      );

      return {
        userId: authorization.user.id,
        organizationId: authorization.organization.id,
        membershipId: authorization.membership.id,
        role: authorization.role,
        sessionId: session.id,
        adminProfileId: session.adminProfileId,
        privilegeType: session.privilegeType,
        permissions:
          authorization.role === "SUPER_ADMIN"
            ? ["*"]
            : await resolveEffectiveAdminPermissions(
                prisma,
                authorization.user.id,
                authorization.organization.id,
              ),
      };
    }

    if (session.scope !== SessionScope.PLATFORM || session.organizationId !== null) {
      throw new AuthenticationError(AuthenticationErrorCode.INVALID_SESSION);
    }

    const authorization = await requirePlatformAuthorization(prisma, session.userId);

    return {
      userId: authorization.user.id,
      organizationId: null,
      membershipId: authorization.membership.id,
      role: authorization.role,
      sessionId: session.id,
      adminProfileId: session.adminProfileId ?? authorization.adminProfileId,
      privilegeType:
        session.privilegeType === SessionPrivilegeType.STANDARD
          ? authorization.role === "SUPER_ADMIN"
            ? SessionPrivilegeType.SUPER_ADMIN
            : SessionPrivilegeType.DELEGATED_ADMIN
          : session.privilegeType,
      permissions:
        authorization.role === "SUPER_ADMIN"
          ? ["*"]
          : await resolveEffectiveAdminPermissions(prisma, authorization.user.id, null),
    };
  } catch (error) {
    throw asAuthenticationError(error);
  }
}

export async function revokeSession(
  prisma: PrismaClient,
  sessionId: string,
  actorUserId: string,
  now = new Date(),
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (transaction) => {
      const result = await transaction.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: now },
      });

      if (result.count === 0) {
        return false;
      }

      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "session.revoked",
          entityType: "Session",
          entityId: sessionId,
        },
      });

      return true;
    });
  } catch (error) {
    throw asAuthenticationError(error);
  }
}

export async function recordAuthenticationFailure(
  prisma: PrismaClient,
  reason: AuthenticationErrorCode,
  userId?: string,
  ipAddress?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId ?? null,
        action: "authentication.failed",
        entityType: "AuthenticationAttempt",
        metadata: { reason },
        ipAddress: ipAddress ?? null,
      },
    });
  } catch (error) {
    throw asAuthenticationError(error);
  }
}
