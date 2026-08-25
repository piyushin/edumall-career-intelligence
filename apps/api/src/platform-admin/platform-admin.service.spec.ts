import {
  AdminProfileStatus,
  AdminScopeType,
  MembershipRole,
  NotificationDeliveryStatus,
  OutboxEventStatus,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { PlatformAdminService } from "./platform-admin.service";

const context: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  organizationId: null,
  role: MembershipRole.SUPER_ADMIN,
};

describe("PlatformAdminService session isolation", () => {
  it("paginates and searches the admin directory with effective permissions and a safe invitation projection", async () => {
    const createdAt = new Date("2026-08-25T10:00:00Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        createdAt,
        status: AdminProfileStatus.ACTIVE,
        user: {
          id: "55555555-5555-4555-8555-555555555555",
          email: "admin@example.com",
          invitationTokens: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              createdAt,
              expiresAt: new Date("2026-09-01T10:00:00Z"),
              usedAt: null,
              revokedAt: null,
              deliveries: [{ status: NotificationDeliveryStatus.BLOCKED_CONFIGURATION }],
            },
          ],
        },
        assignments: [
          {
            roleTemplate: {
              isActive: true,
              permissions: [
                { permission: { code: "admin.view" } },
                { permission: { code: "audit.view" } },
              ],
            },
          },
        ],
      },
    ]);
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit" });
    const prisma = {
      adminProfile: { findMany },
      auditLog: { create: auditCreate },
    } as unknown as PrismaClient;

    const result = await new PlatformAdminService(prisma).listAdmins(context, {
      search: "admin@example.com",
      limit: "25",
    });

    expect(result.pageInfo).toEqual({ hasNext: false, nextCursor: null });
    expect(result.items[0]).toMatchObject({
      effectivePermissions: ["admin.view", "audit.view"],
      invitation: { lifecycleStatus: "PENDING" },
    });
    expect(JSON.stringify(result)).not.toMatch(/tokenHash|passwordHash/);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 26,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "admin.directory.viewed" }),
    });
  });

  it("revokes only sessions attributed to the suspended admin profile", async () => {
    const profileId = "44444444-4444-4444-8444-444444444444";
    const userId = "55555555-5555-4555-8555-555555555555";
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = {
      adminProfile: {
        update: vi
          .fn()
          .mockResolvedValue({ id: profileId, userId, status: AdminProfileStatus.SUSPENDED }),
      },
      session: { updateMany: sessionUpdateMany },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    };
    const prisma = {
      adminProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: profileId, userId, status: AdminProfileStatus.ACTIVE }),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    await new PlatformAdminService(prisma).suspendAdmin(context, profileId);

    expect(sessionUpdateMany).toHaveBeenCalledWith({
      where: { adminProfileId: profileId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(sessionUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId }) }),
    );
  });

  it("creates and audits a platform-scoped delegated administrator with an honest invitation state", async () => {
    const userId = "55555555-5555-4555-8555-555555555555";
    const profileId = "44444444-4444-4444-8444-444444444444";
    const tokenId = "66666666-6666-4666-8666-666666666666";
    const tx = {
      adminRoleTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          id: "77777777-7777-4777-8777-777777777777",
          code: "ADMINISTRATION_ADMIN",
          name: "Administration Admin",
          isActive: true,
          permissions: [{ permission: { code: "admin.view" } }],
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: userId,
          email: "new-admin@example.com",
          status: UserStatus.INVITED,
        }),
      },
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: profileId }),
      },
      organization: {
        findFirst: vi.fn().mockResolvedValue({ id: "88888888-8888-4888-8888-888888888888" }),
      },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "membership" }),
      },
      adminRoleAssignment: {
        create: vi.fn().mockResolvedValue({ id: "99999999-9999-4999-8999-999999999999" }),
      },
      invitationToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi
          .fn()
          .mockImplementation(({ data }) => ({ id: tokenId, expiresAt: data.expiresAt })),
      },
      notificationDelivery: { create: vi.fn().mockResolvedValue({ id: "delivery" }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: "outbox" }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    const result = await new PlatformAdminService(prisma).createAdmin(context, {
      email: "new-admin@example.com",
      firstName: "New",
      lastName: "Admin",
      roleTemplateCode: "ADMINISTRATION_ADMIN",
      scopeType: AdminScopeType.PLATFORM,
    });

    expect(result).toMatchObject({
      profileId,
      userId,
      scopeType: AdminScopeType.PLATFORM,
      invitation: {
        id: tokenId,
        deliveryStatus: NotificationDeliveryStatus.BLOCKED_CONFIGURATION,
      },
    });
    expect(result).not.toHaveProperty("invitation.token");
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "admin.created" }),
    });
  });

  it("creates an honest blocked invitation delivery and idempotent outbox event without exposing a token", async () => {
    const profileId = "44444444-4444-4444-8444-444444444444";
    const userId = "55555555-5555-4555-8555-555555555555";
    const tokenId = "66666666-6666-4666-8666-666666666666";
    const outboxCreate = vi.fn().mockResolvedValue({ id: "outbox" });
    const tx = {
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: profileId,
          user: { id: userId, email: "invited@example.com", status: UserStatus.INVITED },
        }),
      },
      invitationToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi
          .fn()
          .mockImplementation(({ data }) => ({ id: tokenId, expiresAt: data.expiresAt })),
      },
      notificationDelivery: { create: vi.fn().mockResolvedValue({ id: "delivery" }) },
      outboxEvent: { create: outboxCreate },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;
    const result = await new PlatformAdminService(prisma).resendInvitation(context, profileId);
    expect(result).toMatchObject({
      id: tokenId,
      deliveryStatus: NotificationDeliveryStatus.BLOCKED_CONFIGURATION,
    });
    expect(result).not.toHaveProperty("token");
    expect(outboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: `admin-invitation:${tokenId}`,
        status: OutboxEventStatus.BLOCKED_CONFIGURATION,
        payload: expect.objectContaining({ invitationTokenId: tokenId }),
      }),
    });
    expect(JSON.stringify(outboxCreate.mock.calls)).not.toContain("tokenHash");
  });

  it("revokes active invitation tokens and cancels pending delivery work atomically", async () => {
    const profileId = "44444444-4444-4444-8444-444444444444";
    const tokenId = "66666666-6666-4666-8666-666666666666";
    const tx = {
      adminProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: profileId,
          userId: "55555555-5555-4555-8555-555555555555",
        }),
      },
      invitationToken: {
        findMany: vi.fn().mockResolvedValue([{ id: tokenId }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      notificationDelivery: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      outboxEvent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    const result = await new PlatformAdminService(prisma).revokeInvitation(context, profileId);

    expect(result).toMatchObject({ adminProfileId: profileId, invitationCount: 1 });
    expect(tx.invitationToken.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [tokenId] } },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }),
    );
    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "admin.invitation.revoked" }),
    });
  });
});
