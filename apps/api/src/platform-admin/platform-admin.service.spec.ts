import { AdminProfileStatus, MembershipRole, type PrismaClient } from "@prisma/client";
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
});
