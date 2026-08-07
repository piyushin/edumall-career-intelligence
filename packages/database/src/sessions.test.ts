import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  SessionScope,
  type Organization,
  type OrganizationMembership,
  type PrismaClient,
  type Session,
  type User,
  UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthenticationErrorCode } from "./auth-errors";
import { hashOpaqueToken } from "./tokens";
import { recordAuthenticationFailure, revokeSession, validateSessionToken } from "./sessions";

const now = new Date("2026-08-07T12:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const rawToken = "opaque-session-token";

function user(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    email: "active@example.com",
    normalizedEmail: "active@example.com",
    passwordHash: null,
    firstName: "Active",
    lastName: "User",
    status: UserStatus.ACTIVE,
    emailVerifiedAt: now,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: organizationId,
    name: "Active Organization",
    slug: "active-organization",
    status: OrganizationStatus.ACTIVE,
    type: OrganizationType.SCHOOL,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function membership(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership {
  return {
    id: membershipId,
    organizationId,
    userId,
    role: MembershipRole.COUNSELLOR,
    status: MembershipStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: sessionId,
    userId,
    organizationId,
    scope: SessionScope.ORGANIZATION,
    tokenHash: hashOpaqueToken(rawToken),
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
    createdAt: now,
    lastSeenAt: now,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

function sessionPrisma(
  overrides: {
    session?: Session | null;
    user?: User | null;
    organization?: Organization | null;
    membership?: OrganizationMembership | null;
    platformMembership?: OrganizationMembership | null;
  } = {},
): PrismaClient {
  return {
    session: {
      findUnique: vi
        .fn()
        .mockResolvedValue(Object.hasOwn(overrides, "session") ? overrides.session : session()),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(Object.hasOwn(overrides, "user") ? overrides.user : user()),
    },
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          Object.hasOwn(overrides, "organization") ? overrides.organization : organization(),
        ),
    },
    organizationMembership: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          Object.hasOwn(overrides, "membership") ? overrides.membership : membership(),
        ),
      findFirst: vi.fn().mockResolvedValue(overrides.platformMembership ?? null),
    },
  } as unknown as PrismaClient;
}

describe("session validation", () => {
  it("returns a minimal typed context for a valid organization-scoped session", async () => {
    const prisma = sessionPrisma();

    const context = await validateSessionToken(prisma, rawToken, { now });

    expect(context).toEqual({
      userId,
      organizationId,
      membershipId,
      role: MembershipRole.COUNSELLOR,
      sessionId,
    });
    expect(context).not.toHaveProperty("tokenHash");
    expect(context).not.toHaveProperty("passwordHash");
    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOpaqueToken(rawToken) },
    });
  });

  it("rejects a missing session", async () => {
    await expect(
      validateSessionToken(sessionPrisma({ session: null }), rawToken, { now }),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.INVALID_SESSION });
  });

  it("rejects a revoked session", async () => {
    await expect(
      validateSessionToken(sessionPrisma({ session: session({ revokedAt: now }) }), rawToken, {
        now,
      }),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.INVALID_SESSION });
  });

  it("rejects an expired session distinctly", async () => {
    await expect(
      validateSessionToken(sessionPrisma({ session: session({ expiresAt: now }) }), rawToken, {
        now,
      }),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.EXPIRED_SESSION });
  });

  it("does not authorize an organization session with an inactive membership", async () => {
    await expect(
      validateSessionToken(
        sessionPrisma({
          membership: membership({ status: MembershipStatus.SUSPENDED }),
        }),
        rawToken,
        { now },
      ),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.INACTIVE_MEMBERSHIP });
  });

  it("does not infer platform scope from a null organization ID", async () => {
    const prisma = sessionPrisma({ session: session({ organizationId: null }) });

    await expect(validateSessionToken(prisma, rawToken, { now })).rejects.toMatchObject({
      code: AuthenticationErrorCode.INVALID_SESSION,
    });
    expect(prisma.organizationMembership.findFirst).not.toHaveBeenCalled();
  });

  it("requires explicit platform SUPER_ADMIN authorization for an organization-less session", async () => {
    const platformMembership = membership({
      role: MembershipRole.SUPER_ADMIN,
      organizationId: "55555555-5555-4555-8555-555555555555",
    });
    const prisma = sessionPrisma({
      session: session({ organizationId: null, scope: SessionScope.PLATFORM }),
      platformMembership,
    });

    await expect(validateSessionToken(prisma, rawToken, { now })).resolves.toEqual({
      userId,
      organizationId: null,
      membershipId,
      role: MembershipRole.SUPER_ADMIN,
      sessionId,
    });
    expect(prisma.organizationMembership.findFirst).toHaveBeenCalledWith({
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
  });

  it("denies an organization-less session without platform authorization", async () => {
    await expect(
      validateSessionToken(
        sessionPrisma({ session: session({ organizationId: null, scope: SessionScope.PLATFORM }) }),
        rawToken,
        { now },
      ),
    ).rejects.toMatchObject({
      code: AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS,
    });
  });

  it("maps database failures to a domain authentication error", async () => {
    const prisma = sessionPrisma();
    vi.mocked(prisma.session.findUnique).mockRejectedValue(new Error("database details"));

    await expect(validateSessionToken(prisma, rawToken, { now })).rejects.toMatchObject({
      code: AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR,
      message: "Authentication is temporarily unavailable.",
    });
  });
});

describe("session security audit hooks", () => {
  it("revokes a session and writes a token-free audit event transactionally", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({});
    const transaction = {
      session: { updateMany },
      auditLog: { create },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => Promise<boolean>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;

    await expect(revokeSession(prisma, sessionId, userId, now)).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: userId,
        action: "session.revoked",
        entityType: "Session",
        entityId: sessionId,
      },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain(rawToken);
  });

  it("records only a classified authentication failure reason", async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma = { auditLog: { create } } as unknown as PrismaClient;

    await recordAuthenticationFailure(
      prisma,
      AuthenticationErrorCode.INVALID_CREDENTIALS,
      userId,
      "127.0.0.1",
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: userId,
        action: "authentication.failed",
        entityType: "AuthenticationAttempt",
        metadata: { reason: AuthenticationErrorCode.INVALID_CREDENTIALS },
        ipAddress: "127.0.0.1",
      },
    });
  });
});
