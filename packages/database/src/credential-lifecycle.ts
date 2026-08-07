import {
  UserStatus,
  type InvitationToken,
  type PasswordResetToken,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { asAuthenticationError, AuthenticationError, AuthenticationErrorCode } from "./auth-errors";
import { hashPassword } from "./password";
import { hashOpaqueToken } from "./tokens";

export interface CredentialLifecycleOptions {
  now?: Date;
  ipAddress?: string;
}

export interface CredentialLifecycleResult {
  userId: string;
}

function assertInvitationTokenUsable(token: InvitationToken | null, now: Date): InvitationToken {
  if (!token) {
    throw new AuthenticationError(AuthenticationErrorCode.INVALID_INVITATION);
  }

  if (token.usedAt) {
    throw new AuthenticationError(AuthenticationErrorCode.CONSUMED_INVITATION_TOKEN);
  }

  if (token.expiresAt <= now) {
    throw new AuthenticationError(AuthenticationErrorCode.EXPIRED_INVITATION_TOKEN);
  }

  return token;
}

function assertResetTokenUsable(token: PasswordResetToken | null, now: Date): PasswordResetToken {
  if (!token) {
    throw new AuthenticationError(AuthenticationErrorCode.INVALID_RESET_TOKEN);
  }

  if (token.usedAt) {
    throw new AuthenticationError(AuthenticationErrorCode.CONSUMED_RESET_TOKEN);
  }

  if (token.expiresAt <= now) {
    throw new AuthenticationError(AuthenticationErrorCode.EXPIRED_RESET_TOKEN);
  }

  return token;
}

async function consumeInvitationToken(
  transaction: Prisma.TransactionClient,
  token: InvitationToken,
  now: Date,
): Promise<void> {
  const result = await transaction.invitationToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (result.count === 0) {
    const current = await transaction.invitationToken.findUnique({ where: { id: token.id } });
    assertInvitationTokenUsable(current, now);
    throw new AuthenticationError(AuthenticationErrorCode.INVALID_INVITATION);
  }
}

async function consumeResetToken(
  transaction: Prisma.TransactionClient,
  token: PasswordResetToken,
  now: Date,
): Promise<void> {
  const result = await transaction.passwordResetToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (result.count === 0) {
    const current = await transaction.passwordResetToken.findUnique({ where: { id: token.id } });
    assertResetTokenUsable(current, now);
    throw new AuthenticationError(AuthenticationErrorCode.INVALID_RESET_TOKEN);
  }
}

export async function acceptInvitation(
  prisma: PrismaClient,
  rawToken: string,
  password: string,
  options: CredentialLifecycleOptions = {},
): Promise<CredentialLifecycleResult> {
  try {
    const now = options.now ?? new Date();
    const passwordHash = await hashPassword(password);
    const tokenHash = hashOpaqueToken(rawToken);

    const result = await prisma.$transaction(async (transaction) => {
      const token = assertInvitationTokenUsable(
        await transaction.invitationToken.findUnique({ where: { tokenHash } }),
        now,
      );
      const user = await transaction.user.findUnique({ where: { id: token.userId } });

      if (!user || user.status !== UserStatus.INVITED) {
        throw new AuthenticationError(AuthenticationErrorCode.INVALID_INVITATION);
      }

      await consumeInvitationToken(transaction, token, now);

      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });

      return { userId: user.id };
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: result.userId,
          action: "invitation.accepted",
          entityType: "User",
          entityId: result.userId,
          ipAddress: options.ipAddress ?? null,
        },
      });
    } catch {
      // Credential lifecycle success must not depend on audit storage availability.
    }

    return result;
  } catch (error) {
    throw asAuthenticationError(error);
  }
}

export async function consumePasswordResetToken(
  prisma: PrismaClient,
  rawToken: string,
  newPassword: string,
  options: CredentialLifecycleOptions = {},
): Promise<CredentialLifecycleResult> {
  try {
    const now = options.now ?? new Date();
    const passwordHash = await hashPassword(newPassword);
    const tokenHash = hashOpaqueToken(rawToken);

    const result = await prisma.$transaction(async (transaction) => {
      const token = assertResetTokenUsable(
        await transaction.passwordResetToken.findUnique({ where: { tokenHash } }),
        now,
      );
      const user = await transaction.user.findUnique({ where: { id: token.userId } });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new AuthenticationError(AuthenticationErrorCode.INACTIVE_USER);
      }

      await consumeResetToken(transaction, token, now);

      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await transaction.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return { userId: user.id };
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: result.userId,
          action: "password_reset.consumed",
          entityType: "User",
          entityId: result.userId,
          ipAddress: options.ipAddress ?? null,
        },
      });
    } catch {
      // Credential lifecycle success must not depend on audit storage availability.
    }

    return result;
  } catch (error) {
    throw asAuthenticationError(error);
  }
}
