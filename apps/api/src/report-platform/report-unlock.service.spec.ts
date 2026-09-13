import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { ReportUnlockService } from "./report-unlock.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "99999999-9999-4999-8999-999999999999";
const candidateUserId = "12121212-1212-4121-8121-121212121212";
const counsellorUserId = "55555555-5555-4555-8555-555555555555";
const organizationWalletId = "22222222-2222-4222-8222-222222222222";
const counsellorWalletId = "66666666-6666-4666-8666-666666666666";
const attemptId = "33333333-3333-4333-8333-333333333333";
const secondAttemptId = "34343434-3434-4343-8343-343434343434";

const tenantAdmin: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444444",
  organizationId,
  membershipId: "m",
  role: MembershipRole.ORGANIZATION_ADMIN,
  sessionId: "session",
  permissions: [],
};
const counsellor: AuthContext = {
  ...tenantAdmin,
  userId: counsellorUserId,
  role: MembershipRole.COUNSELLOR,
};
const central: AuthContext = {
  ...tenantAdmin,
  userId: "77777777-7777-4777-8777-777777777777",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  permissions: ["*"],
};

const organizationWallet = {
  id: organizationWalletId,
  ownerType: "ORGANIZATION",
  ownerUserId: null,
  ownerOrganizationId: organizationId,
  status: "ACTIVE",
  currentBalance: 3,
};
const counsellorWallet = {
  id: counsellorWalletId,
  ownerType: "USER",
  ownerUserId: counsellorUserId,
  ownerOrganizationId: null,
  status: "ACTIVE",
  currentBalance: 1,
};

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: attemptId,
    status: "SUBMITTED",
    assignment: {
      organizationId,
      userId: candidateUserId,
      metadata: { registrationSource: "PUBLIC_SIGNUP" },
    },
    reportGeneration: { status: "GENERATED" },
    ...overrides,
  };
}

function harness(
  options: {
    wallet?: Record<string, unknown> | null;
    attempts?: Record<string, Record<string, unknown> | null>;
    existingGrant?: boolean;
    existingEntitlement?: boolean;
    priorCharge?: boolean;
    balance?: number;
    assigned?: boolean;
  } = {},
) {
  let balance = options.balance ?? 3;
  const attempts: Record<string, Record<string, unknown> | null> = options.attempts ?? {
    [attemptId]: attempt(),
  };
  const tx = {
    commerceCreditWallet: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.wallet === undefined ? organizationWallet : options.wallet),
      updateMany: vi.fn().mockImplementation(() => {
        if (balance >= 1) {
          balance -= 1;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ currentBalance: balance })),
    },
    assessmentAttempt: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) => Promise.resolve(attempts[where.id] ?? null)),
    },
    organizationMembership: { findFirst: vi.fn().mockResolvedValue({ id: "membership" }) },
    candidateCounsellorAssignment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.assigned === false ? null : { id: "assignment" }),
    },
    commerceReportAccessGrant: {
      findFirst: vi.fn().mockResolvedValue(options.existingGrant ? { id: "existing-grant" } : null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "grant", ...data })),
      update: vi.fn().mockResolvedValue({}),
    },
    commerceEntitlement: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.existingEntitlement ? { id: "existing-entitlement" } : null),
      upsert: vi.fn().mockResolvedValue({ id: "entitlement" }),
    },
    commerceCreditLedgerEntry: {
      findFirst: vi.fn().mockResolvedValue(options.priorCharge ? { id: "prior" } : null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "ledger", ...data })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { tx, service: new ReportUnlockService(prisma as unknown as PrismaClient) };
}

describe("ReportUnlockService — one credit, one attempt, one principal", () => {
  it("organisation unlock consumes exactly one credit and grants only the organisation", async () => {
    const { service, tx } = harness();
    const result = await service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" });
    expect(result.status).toBe("charged");
    expect(tx.commerceCreditWallet.updateMany).toHaveBeenCalledOnce();
    expect(tx.commerceReportAccessGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        principalType: "ORGANIZATION",
        principalOrganizationId: organizationId,
        principalUserId: null,
        source: "CREDIT",
      }),
      select: { id: true },
    });
    expect(tx.commerceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "CONSUMPTION",
        quantity: 1,
        delta: -1,
        attemptId,
        principalKey: `ORGANIZATION:${organizationId}`,
        reportAccessGrantId: "grant",
        entitlementId: null,
      }),
      select: { id: true },
    });
    expect(tx.commerceReportAccessGrant.update).toHaveBeenCalledWith({
      where: { id: "grant" },
      data: { creditLedgerEntryId: "ledger" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(result.balance).toBe(2);
  });

  it("counsellor unlock consumes one own credit and grants only the counsellor", async () => {
    const { service, tx } = harness({ wallet: counsellorWallet, balance: 1 });
    const result = await service.unlock(counsellor, { attemptId, mode: "COUNSELLOR" });
    expect(result.status).toBe("charged");
    expect(tx.commerceCreditWallet.findFirst.mock.calls[0]![0].where).toMatchObject({
      ownerType: "USER",
      ownerUserId: counsellorUserId,
    });
    expect(tx.candidateCounsellorAssignment.findFirst).toHaveBeenCalled();
    expect(tx.commerceReportAccessGrant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ principalType: "USER", principalUserId: counsellorUserId }),
      select: { id: true },
    });
    expect(tx.commerceEntitlement.upsert).not.toHaveBeenCalled();
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ principalKey: `USER:${counsellorUserId}` }),
      select: { id: true },
    });
  });

  it("sponsored candidate unlock consumes one organisation credit and creates only the candidate entitlement", async () => {
    const { service, tx } = harness();
    const result = await service.unlock(tenantAdmin, { attemptId, mode: "CANDIDATE" });
    expect(result.status).toBe("charged");
    expect(result.entitlement).toEqual({ id: "entitlement" });
    expect(tx.commerceEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: candidateUserId,
          attemptId,
          type: "REPORT",
          source: "TENANT_CREDIT",
        }),
      }),
    );
    expect(tx.commerceReportAccessGrant.create).not.toHaveBeenCalled();
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        principalKey: `CANDIDATE:${candidateUserId}`,
        entitlementId: "entitlement",
        reportAccessGrantId: null,
      }),
      select: { id: true },
    });
  });

  it("does not create a candidate entitlement in organisation mode, nor a grant in candidate mode", async () => {
    const organisation = harness();
    await organisation.service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" });
    expect(organisation.tx.commerceEntitlement.upsert).not.toHaveBeenCalled();
    const sponsored = harness();
    await sponsored.service.unlock(tenantAdmin, { attemptId, mode: "CANDIDATE" });
    expect(sponsored.tx.commerceReportAccessGrant.create).not.toHaveBeenCalled();
  });

  it("does not double-charge a duplicate unlock", async () => {
    const granted = harness({ existingGrant: true });
    const result = await granted.service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" });
    expect(result.status).toBe("already_granted");
    expect(granted.tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();
    expect(granted.tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();

    const sponsored = harness({ existingEntitlement: true });
    expect(
      (await sponsored.service.unlock(tenantAdmin, { attemptId, mode: "CANDIDATE" })).status,
    ).toBe("already_granted");
    expect(sponsored.tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();

    const priorLedger = harness({ priorCharge: true });
    expect(
      (await priorLedger.service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" })).status,
    ).toBe("already_granted");
    expect(priorLedger.tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();
  });

  it("rejects unauthorised principal selection by role", async () => {
    const asCounsellor = harness({ wallet: counsellorWallet });
    await expect(
      asCounsellor.service.unlock(counsellor, { attemptId, mode: "ORGANIZATION" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      asCounsellor.service.unlock(counsellor, { attemptId, mode: "CANDIDATE" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const asTenant = harness();
    await expect(
      asTenant.service.unlock(tenantAdmin, { attemptId, mode: "COUNSELLOR" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      asTenant.service.unlock(central, { attemptId, mode: "ORGANIZATION" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("skips attempts outside the wallet owner's organisation and unassigned counsellor candidates", async () => {
    const crossTenant = harness({
      attempts: {
        [attemptId]: attempt({
          assignment: {
            organizationId: otherOrganizationId,
            userId: candidateUserId,
            metadata: {},
          },
        }),
      },
    });
    const result = await crossTenant.service.unlock(tenantAdmin, {
      attemptId,
      mode: "ORGANIZATION",
    });
    expect(result.status).toBe("skipped:OUT_OF_SCOPE");
    expect(crossTenant.tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();

    const unassigned = harness({ wallet: counsellorWallet, assigned: false });
    expect(
      (await unassigned.service.unlock(counsellor, { attemptId, mode: "COUNSELLOR" })).status,
    ).toBe("skipped:CANDIDATE_NOT_ASSIGNED");
  });

  it("refuses suspended wallets, ungenerated reports and empty balances without ledger writes", async () => {
    const suspended = harness({ wallet: { ...organizationWallet, status: "SUSPENDED" } });
    expect(
      (await suspended.service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" })).status,
    ).toBe("skipped:WALLET_INACTIVE");
    const pending = harness({
      attempts: { [attemptId]: attempt({ reportGeneration: { status: "PROCESSING" } }) },
    });
    expect(
      (await pending.service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" })).status,
    ).toBe("skipped:REPORT_NOT_GENERATED");
    const empty = harness({ balance: 0 });
    expect(
      (await empty.service.unlock(tenantAdmin, { attemptId, mode: "ORGANIZATION" })).status,
    ).toBe("skipped:INSUFFICIENT_BALANCE");
    for (const h of [suspended, pending, empty]) {
      expect(h.tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
      expect(h.tx.commerceReportAccessGrant.create).not.toHaveBeenCalled();
    }
  });

  it("skips sponsoring institutional candidates who already have non-commercial access", async () => {
    const { service, tx } = harness({
      attempts: {
        [attemptId]: attempt({
          assignment: { organizationId, userId: candidateUserId, metadata: {} },
        }),
      },
    });
    expect((await service.unlock(tenantAdmin, { attemptId, mode: "CANDIDATE" })).status).toBe(
      "skipped:CANDIDATE_ACCESS_NOT_REQUIRED",
    );
    expect(tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();
  });

  it("bulk unlock charges one credit per attempt with per-item accounting and a visible summary", async () => {
    const { service, tx } = harness({
      balance: 1,
      attempts: {
        [attemptId]: attempt(),
        [secondAttemptId]: attempt({ id: secondAttemptId }),
      },
    });
    const result = await service.bulkUnlock(tenantAdmin, {
      attemptIds: [attemptId, secondAttemptId, attemptId],
      mode: "ORGANIZATION",
    });
    expect(result.items.map((item) => item.status)).toEqual([
      "charged",
      "skipped:INSUFFICIENT_BALANCE",
    ]);
    expect(result.summary).toEqual({ charged: 1, alreadyGranted: 0, skipped: 1 });
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledOnce();
    await expect(
      service.bulkUnlock(tenantAdmin, { attemptIds: [attemptId], mode: "COUNSELLOR" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.bulkUnlock(counsellor, { attemptIds: [attemptId], mode: "COUNSELLOR" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
