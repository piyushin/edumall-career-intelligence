import { loadConfig } from "@edumall/config";
import {
  AuthenticationError,
  AuthenticationErrorCode,
  acceptInvitation,
  consumePasswordResetToken,
  recordAuthenticationFailure,
  requireActiveOrganizationMembership,
  requirePlatformAuthorization,
  verifyPassword,
  verifyUserPassword,
} from "@edumall/database";
import { MembershipRole, SessionScope, type PrismaClient, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

vi.mock("@edumall/database", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    acceptInvitation: vi.fn(),
    consumePasswordResetToken: vi.fn(),
    recordAuthenticationFailure: vi.fn(),
    requireActiveOrganizationMembership: vi.fn(),
    requirePlatformAuthorization: vi.fn(),
    verifyPassword: vi.fn(),
    verifyUserPassword: vi.fn(),
  };
});

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const user = {
  email: "User@Example.com",
  id: userId,
  lockedUntil: null,
  passwordHash: "$argon2id$test",
  status: UserStatus.ACTIVE,
};
const config = loadConfig(
  {
    APP_ENV: "test",
    APP_VERSION: "test",
    AUTH_SESSION_TTL_SECONDS: "3600",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    NODE_ENV: "test",
    REDIS_URL: "redis://localhost:6379",
  },
  { serviceName: "api" },
);

function createPrisma() {
  return {
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    session: {
      create: vi.fn().mockResolvedValue({ id: sessionId }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("AuthService", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createPrisma();
    service = new AuthService(prisma as unknown as PrismaClient, config);
    vi.mocked(verifyUserPassword).mockResolvedValue(true);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    vi.mocked(requireActiveOrganizationMembership).mockResolvedValue({
      membership: { id: membershipId },
      organization: { id: organizationId },
      role: MembershipRole.ORGANIZATION_ADMIN,
      user: { id: userId },
    } as Awaited<ReturnType<typeof requireActiveOrganizationMembership>>);
    vi.mocked(requirePlatformAuthorization).mockResolvedValue({
      membership: { id: membershipId },
      role: MembershipRole.SUPER_ADMIN,
      user: { id: userId },
    } as Awaited<ReturnType<typeof requirePlatformAuthorization>>);
  });

  it("normalizes email once and looks up the unique normalizedEmail field", async () => {
    await service.login("  USER@Example.COM  ", "password", organizationId);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      select: {
        email: true,
        id: true,
        lockedUntil: true,
        passwordHash: true,
        status: true,
      },
      where: { normalizedEmail: "user@example.com" },
    });
  });

  it("issues an organization-scoped session from enforced active membership", async () => {
    const result = await service.login("user@example.com", "password", organizationId);

    expect(requireActiveOrganizationMembership).toHaveBeenCalledWith(
      prisma,
      userId,
      organizationId,
    );
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        scope: SessionScope.ORGANIZATION,
        userId,
      }),
    });
    expect(result.context).toMatchObject({
      membershipId,
      organizationId,
      role: MembershipRole.ORGANIZATION_ADMIN,
      sessionId,
      userId,
    });
  });

  it("issues a platform session only through platform authorization", async () => {
    const result = await service.login("user@example.com", "password");

    expect(requirePlatformAuthorization).toHaveBeenCalledWith(prisma, userId);
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: null,
        scope: SessionScope.PLATFORM,
      }),
    });
    expect(result.context).toMatchObject({
      organizationId: null,
      role: MembershipRole.SUPER_ADMIN,
    });
  });

  it("returns the same invalid-credentials error for unknown email and bad password", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.login("missing@example.com", "password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });
    expect(verifyPassword).toHaveBeenCalledWith(expect.stringContaining("$argon2id$"), "password");

    prisma.user.findUnique.mockResolvedValueOnce(user);
    vi.mocked(verifyUserPassword).mockResolvedValueOnce(false);

    await expect(service.login("user@example.com", "bad-password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });
  });

  it.each([UserStatus.SUSPENDED, UserStatus.LOCKED])(
    "does not reveal a %s account state",
    async (status) => {
      prisma.user.findUnique.mockResolvedValueOnce({ ...user, status });
      vi.mocked(verifyUserPassword).mockResolvedValueOnce(false);

      await expect(service.login("user@example.com", "password")).rejects.toMatchObject({
        code: AuthenticationErrorCode.INVALID_CREDENTIALS,
      });
    },
  );

  it("does not allow an active user with a future lock deadline", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...user,
      lockedUntil: new Date(Date.now() + 60_000),
    });

    await expect(service.login("user@example.com", "password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });
  });

  it("locks the account once failed logins reach the configured threshold", async () => {
    // Regression test: AuthService.login already rejects login while lockedUntil is in
    // the future, but nothing previously ever set lockedUntil -- a failed login was
    // only ever audit-logged, never counted against the account. This simulates the
    // Nth failure (N = the configured threshold) by having the atomic increment return
    // the post-increment count, matching how Prisma's `{ increment: 1 }` behaves.
    vi.mocked(verifyUserPassword).mockResolvedValueOnce(false);
    prisma.user.update.mockResolvedValueOnce({ failedLoginCount: config.authLockoutThreshold });

    await expect(service.login("user@example.com", "bad-password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { lockedUntil: expect.any(Date) },
    });

    const lockCall = prisma.user.update.mock.calls.find(
      ([args]) => (args as { data?: { lockedUntil?: unknown } }).data?.lockedUntil,
    );
    const lockedUntil = (lockCall?.[0] as { data: { lockedUntil: Date } } | undefined)?.data
      .lockedUntil;
    expect(lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not lock the account before the failure threshold is reached", async () => {
    vi.mocked(verifyUserPassword).mockResolvedValueOnce(false);
    prisma.user.update.mockResolvedValueOnce({
      failedLoginCount: config.authLockoutThreshold - 1,
    });

    await expect(service.login("user@example.com", "bad-password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lockedUntil: expect.anything() }),
      }),
    );
  });

  it("does not attempt lockout bookkeeping for an email that matches no account", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.login("missing@example.com", "password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("clears failedLoginCount and lockedUntil on a successful login", async () => {
    await service.login("user@example.com", "password", organizationId);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: expect.any(Date) },
    });
  });

  it("does not reveal an inactive membership", async () => {
    vi.mocked(requireActiveOrganizationMembership).mockRejectedValueOnce(
      new AuthenticationError(AuthenticationErrorCode.INACTIVE_MEMBERSHIP),
    );

    await expect(
      service.login("user@example.com", "password", organizationId),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.INVALID_CREDENTIALS });
  });

  it("maps infrastructure failures to a safe service error", async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error("database host details"));

    await expect(service.login("user@example.com", "password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR,
    });
  });

  it("does not change successful login when activity or audit writes fail", async () => {
    prisma.user.update.mockRejectedValueOnce(new Error("activity unavailable"));
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      service.login("user@example.com", "password", organizationId),
    ).resolves.toMatchObject({ context: { sessionId } });
  });

  it("does not change invalid-credential responses when failure auditing fails", async () => {
    vi.mocked(verifyUserPassword).mockResolvedValueOnce(false);
    vi.mocked(recordAuthenticationFailure).mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(service.login("user@example.com", "bad-password")).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_CREDENTIALS,
    });
  });

  it("revokes logout sessions and ignores a subsequent audit failure", async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      service.logout({
        membershipId,
        organizationId,
        role: MembershipRole.ORGANIZATION_ADMIN,
        sessionId,
        userId,
      }),
    ).resolves.toBeUndefined();
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: { id: sessionId, revokedAt: null, userId },
    });
  });

  it("delegates invitation acceptance and password reset confirmation", async () => {
    vi.mocked(acceptInvitation).mockResolvedValueOnce({ userId });
    vi.mocked(consumePasswordResetToken).mockResolvedValueOnce({ userId });

    await expect(
      service.acceptInvitation("invitation-token", "long-enough-password", "127.0.0.1"),
    ).resolves.toEqual({ userId });
    await expect(
      service.confirmPasswordReset("reset-token", "long-enough-password", "127.0.0.1"),
    ).resolves.toEqual({ userId });
  });
});
