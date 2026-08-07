import {
  type InvitationToken,
  type PasswordResetToken,
  type PrismaClient,
  type User,
  UserStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationErrorCode } from "./auth-errors";
import { acceptInvitation, consumePasswordResetToken } from "./credential-lifecycle";
import { hashPassword } from "./password";
import { hashOpaqueToken } from "./tokens";

vi.mock("./password", () => ({
  hashPassword: vi.fn().mockResolvedValue("$argon2id$test-password-hash"),
}));

const now = new Date("2026-08-07T12:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";
const tokenId = "22222222-2222-4222-8222-222222222222";

function user(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    email: "invited@example.com",
    normalizedEmail: "invited@example.com",
    passwordHash: null,
    firstName: "Invited",
    lastName: "User",
    status: UserStatus.INVITED,
    emailVerifiedAt: null,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function invitationToken(
  rawToken: string,
  overrides: Partial<InvitationToken> = {},
): InvitationToken {
  return {
    id: tokenId,
    userId,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt: new Date(now.getTime() + 60_000),
    usedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function resetToken(
  rawToken: string,
  overrides: Partial<PasswordResetToken> = {},
): PasswordResetToken {
  return {
    id: tokenId,
    userId,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt: new Date(now.getTime() + 60_000),
    usedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function transactionalPrisma(transaction: object): PrismaClient {
  return {
    $transaction: vi.fn(async (callback: (value: object) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as PrismaClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invitation acceptance", () => {
  const rawToken = "raw-invitation-token";
  const password = "new invitation password";

  function transaction(token: InvitationToken | null = invitationToken(rawToken)) {
    return {
      invitationToken: {
        findUnique: vi.fn().mockResolvedValue(token),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(user()),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
  }

  it("atomically consumes the hashed token, sets a password, activates the user, and audits", async () => {
    const tx = transaction();
    const prisma = transactionalPrisma(tx);

    await expect(
      acceptInvitation(prisma, rawToken, password, { now, ipAddress: "127.0.0.1" }),
    ).resolves.toEqual({ userId });

    expect(tx.invitationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOpaqueToken(rawToken) },
    });
    expect(tx.invitationToken.updateMany).toHaveBeenCalledWith({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        passwordHash: "$argon2id$test-password-hash",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: userId,
        action: "invitation.accepted",
        entityType: "User",
        entityId: userId,
        ipAddress: "127.0.0.1",
      },
    });
    expect(JSON.stringify(tx)).not.toContain(rawToken);
    expect(hashPassword).toHaveBeenCalledWith(password);
  });

  it("rejects an expired invitation token", async () => {
    const tx = transaction(invitationToken(rawToken, { expiresAt: new Date(now.getTime() - 1) }));

    await expect(
      acceptInvitation(transactionalPrisma(tx), rawToken, password, { now }),
    ).rejects.toMatchObject({
      code: AuthenticationErrorCode.EXPIRED_INVITATION_TOKEN,
    });
    expect(tx.invitationToken.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an already-used invitation token", async () => {
    const tx = transaction(invitationToken(rawToken, { usedAt: now }));

    await expect(
      acceptInvitation(transactionalPrisma(tx), rawToken, password, { now }),
    ).rejects.toMatchObject({
      code: AuthenticationErrorCode.CONSUMED_INVITATION_TOKEN,
    });
  });

  it("rejects a token lost to a concurrent consumer", async () => {
    const tx = transaction();
    tx.invitationToken.updateMany.mockResolvedValue({ count: 0 });
    tx.invitationToken.findUnique
      .mockResolvedValueOnce(invitationToken(rawToken))
      .mockResolvedValueOnce(invitationToken(rawToken, { usedAt: now }));

    await expect(
      acceptInvitation(transactionalPrisma(tx), rawToken, password, { now }),
    ).rejects.toMatchObject({
      code: AuthenticationErrorCode.CONSUMED_INVITATION_TOKEN,
    });
  });
});

describe("password reset consumption", () => {
  const rawToken = "raw-reset-token";
  const password = "replacement password";

  function transaction(token: PasswordResetToken | null = resetToken(rawToken)) {
    return {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue(token),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(user({ status: UserStatus.ACTIVE })),
        update: vi.fn().mockResolvedValue({}),
      },
      session: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
  }

  it("atomically consumes the token, updates credentials, revokes sessions, and audits", async () => {
    const tx = transaction();

    await expect(
      consumePasswordResetToken(transactionalPrisma(tx), rawToken, password, { now }),
    ).resolves.toEqual({ userId });

    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: tokenId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: userId,
        action: "password_reset.consumed",
        entityType: "User",
        entityId: userId,
        ipAddress: null,
      },
    });
  });

  it("rejects an expired reset token", async () => {
    const tx = transaction(resetToken(rawToken, { expiresAt: now }));

    await expect(
      consumePasswordResetToken(transactionalPrisma(tx), rawToken, password, { now }),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.EXPIRED_RESET_TOKEN });
    expect(tx.passwordResetToken.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an already-consumed reset token", async () => {
    const tx = transaction(resetToken(rawToken, { usedAt: now }));

    await expect(
      consumePasswordResetToken(transactionalPrisma(tx), rawToken, password, { now }),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.CONSUMED_RESET_TOKEN });
  });

  it("does not reset credentials for an inactive user", async () => {
    const tx = transaction();
    tx.user.findUnique.mockResolvedValue(user({ status: UserStatus.SUSPENDED }));

    await expect(
      consumePasswordResetToken(transactionalPrisma(tx), rawToken, password, { now }),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.INACTIVE_USER });
    expect(tx.passwordResetToken.updateMany).not.toHaveBeenCalled();
  });
});
