import { readFileSync } from "node:fs";
import { MembershipRole, MembershipStatus, type PrismaClient, type Session } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  createAuditLog,
  createPrismaClient,
  findActivePasswordResetTokenByToken,
  findActiveSessionByToken,
  findOrganizationMembership,
  hashOpaqueToken,
  normalizeEmail,
} from "./index";

const rawSessionToken = "raw-session-token";
const now = new Date();

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    organizationId: "33333333-3333-4333-8333-333333333333",
    tokenHash: hashOpaqueToken(rawSessionToken),
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
    createdAt: now,
    lastSeenAt: now,
    ipAddress: null,
    userAgent: null,
    ...overrides,
  };
}

describe("database package", () => {
  it("normalizes email addresses for uniqueness checks", () => {
    expect(normalizeEmail("  User.Name+tag@Example.COM  ")).toBe("user.name+tag@example.com");
  });

  it("hashes opaque tokens deterministically as lowercase SHA-256 hex", () => {
    const firstHash = hashOpaqueToken("same-token");
    const secondHash = hashOpaqueToken("same-token");

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("never returns the plaintext opaque token as its hash", () => {
    const token = "plaintext-must-not-be-persisted";

    expect(hashOpaqueToken(token)).not.toBe(token);
  });

  it("defines membership uniqueness per organization and user", () => {
    const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

    expect(schema).toContain("@@unique([organizationId, userId])");
  });

  it("looks up membership with both organization and user scope", async () => {
    const membership = {
      id: "44444444-4444-4444-8444-444444444444",
      organizationId: "33333333-3333-4333-8333-333333333333",
      userId: "22222222-2222-4222-8222-222222222222",
      role: MembershipRole.STUDENT,
      status: MembershipStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };
    const findUnique = vi.fn().mockResolvedValue(membership);
    const prisma = {
      organizationMembership: { findUnique },
    } as unknown as PrismaClient;

    await expect(
      findOrganizationMembership(prisma, membership.organizationId, membership.userId),
    ).resolves.toEqual(membership);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: membership.organizationId,
          userId: membership.userId,
        },
      },
    });
  });

  it("finds an unexpired, unrevoked session using the raw token hash", async () => {
    const activeSession = session();
    const findUnique = vi.fn().mockResolvedValue(activeSession);
    const prisma = { session: { findUnique } } as unknown as PrismaClient;

    await expect(findActiveSessionByToken(prisma, rawSessionToken)).resolves.toEqual(activeSession);
    expect(findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOpaqueToken(rawSessionToken) },
    });
  });

  it("rejects an expired session", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue(session({ expiresAt: new Date(now.getTime() - 1) }));
    const prisma = { session: { findUnique } } as unknown as PrismaClient;

    await expect(findActiveSessionByToken(prisma, rawSessionToken)).resolves.toBeNull();
  });

  it("rejects a revoked session", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue(session({ revokedAt: new Date(now.getTime() - 1) }));
    const prisma = { session: { findUnique } } as unknown as PrismaClient;

    await expect(findActiveSessionByToken(prisma, rawSessionToken)).resolves.toBeNull();
  });

  it("rejects an expired password-reset token", async () => {
    const rawToken = "raw-password-reset-token";
    const findUnique = vi.fn().mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      userId: "22222222-2222-4222-8222-222222222222",
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(now.getTime() - 1),
      usedAt: null,
      createdAt: now,
    });
    const prisma = {
      passwordResetToken: { findUnique },
    } as unknown as PrismaClient;

    await expect(findActivePasswordResetTokenByToken(prisma, rawToken)).resolves.toBeNull();
  });

  it("creates an audit log without transforming its scoped input", async () => {
    const input = {
      organizationId: "33333333-3333-4333-8333-333333333333",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      action: "membership.created",
      entityType: "OrganizationMembership",
      entityId: "44444444-4444-4444-8444-444444444444",
      metadata: { role: "STUDENT" },
      ipAddress: "127.0.0.1",
    };
    const createdAuditLog = {
      id: "66666666-6666-4666-8666-666666666666",
      ...input,
      createdAt: now,
    };
    const create = vi.fn().mockResolvedValue(createdAuditLog);
    const prisma = { auditLog: { create } } as unknown as PrismaClient;

    await expect(createAuditLog(prisma, input)).resolves.toEqual(createdAuditLog);
    expect(create).toHaveBeenCalledWith({ data: input });
  });

  it("creates a Prisma client safely without connecting during construction", async () => {
    const client = createPrismaClient(
      "postgresql://edumall:local@localhost:5432/edumall_test?schema=public",
    );

    expect(client).toBeDefined();
    await client.$disconnect();
  });
});
