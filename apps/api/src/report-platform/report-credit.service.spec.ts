import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  CommerceCreditWalletOwnerType,
  CommerceCreditWalletStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { ReportCreditService } from "./report-credit.service";
import type { ReportUnlockService } from "./report-unlock.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "99999999-9999-4999-8999-999999999999";
const walletId = "22222222-2222-4222-8222-222222222222";
const counsellorWalletId = "66666666-6666-4666-8666-666666666666";
const counsellorUserId = "55555555-5555-4555-8555-555555555555";
const transferKey = "77777777-7777-4777-8777-777777777777";
const central: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444444",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "session",
  permissions: ["*"],
};
const tenantAdmin: AuthContext = {
  ...central,
  organizationId,
  role: MembershipRole.ORGANIZATION_ADMIN,
  permissions: ["report.credit.manage"],
};
const organizationWallet = {
  id: walletId,
  ownerType: CommerceCreditWalletOwnerType.ORGANIZATION,
  ownerUserId: null,
  ownerOrganizationId: organizationId,
  creditType: "REPORT_ACCESS",
  status: CommerceCreditWalletStatus.ACTIVE,
  currentBalance: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const counsellorWallet = {
  ...organizationWallet,
  id: counsellorWalletId,
  ownerType: CommerceCreditWalletOwnerType.USER,
  ownerUserId: counsellorUserId,
  ownerOrganizationId: null,
  currentBalance: 0,
};

function client(
  options: {
    insufficient?: boolean;
    membership?: boolean;
    replay?: boolean;
    sourceStatus?: CommerceCreditWalletStatus;
  } = {},
) {
  const source = { ...organizationWallet, status: options.sourceStatus ?? "ACTIVE" };
  const tx = {
    commerceCreditWallet: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            where.ownerType === "USER" || where.id === counsellorWalletId
              ? counsellorWallet
              : where.id && where.id !== walletId
                ? null
                : source,
          ),
        ),
      create: vi.fn().mockResolvedValue(counsellorWallet),
      update: vi.fn().mockResolvedValue({ currentBalance: 7 }),
      updateMany: vi.fn().mockResolvedValue({ count: options.insufficient ? 0 : 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ currentBalance: 3 }),
    },
    commerceCreditLedgerEntry: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "ledger", ...data })),
      groupBy: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(options.replay ? { walletId, quantity: 2 } : null),
      findMany: vi
        .fn()
        .mockResolvedValue([{ eventType: "TRANSFER_OUT" }, { eventType: "TRANSFER_IN" }]),
    },
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(options.membership === false ? null : { id: "m" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown, _options: unknown) =>
      callback(tx),
    ),
  };
  const unlocks = { unlock: vi.fn() };
  return {
    prisma,
    tx,
    unlocks,
    service: new ReportCreditService(
      prisma as unknown as PrismaClient,
      unlocks as unknown as ReportUnlockService,
    ),
  };
}

describe("ReportCreditService", () => {
  it("allots complimentary credits centrally with ledger and audit evidence", async () => {
    const { service, tx, prisma } = client();
    const result = await service.allot(central, walletId, 2, "complimentary");
    expect(tx.commerceCreditWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentBalance: { increment: 2 } } }),
    );
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "ADMIN_ALLOTMENT", quantity: 2, delta: 2 }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(result.balance).toBe(7);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("never lets tenant administrators mint or revoke complimentary credits", async () => {
    const { service, tx } = client();
    await expect(service.allot(tenantAdmin, walletId, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.revokeUnusedAdminCredits(tenantAdmin, walletId, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.setStatus(tenantAdmin, walletId, { status: "SUSPENDED" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.searchWallets(tenantAdmin, { page: 1, pageSize: 25 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.commerceCreditWallet.update).not.toHaveBeenCalled();
  });

  it("transfers organisation credits to a same-tenant counsellor atomically with a shared transfer id", async () => {
    const { service, tx } = client();
    const result = await service.transfer(tenantAdmin, {
      counsellorUserId,
      quantity: 2,
      transferKey,
      reference: "batch-1",
    });
    expect(result.transferred).toBe(true);
    expect(tx.organizationMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId,
          userId: counsellorUserId,
          role: "COUNSELLOR",
          status: "ACTIVE",
        }),
      }),
    );
    expect(tx.commerceCreditWallet.updateMany).toHaveBeenCalledWith({
      where: { id: walletId, status: "ACTIVE", currentBalance: { gte: 2 } },
      data: { currentBalance: { decrement: 2 } },
    });
    expect(tx.commerceCreditWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: counsellorWalletId },
        data: { currentBalance: { increment: 2 } },
      }),
    );
    const legs = tx.commerceCreditLedgerEntry.create.mock.calls.map(([call]) => call.data);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({
      walletId,
      eventType: "TRANSFER_OUT",
      quantity: 2,
      delta: -2,
      transferId: transferKey,
      reference: "batch-1",
    });
    expect(legs[1]).toMatchObject({
      walletId: counsellorWalletId,
      eventType: "TRANSFER_IN",
      quantity: 2,
      delta: 2,
      transferId: transferKey,
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "report.credit.transferred", organizationId }),
    });
  });

  it("denies transfers to counsellors outside the source organisation", async () => {
    const { service, tx } = client({ membership: false });
    await expect(
      service.transfer(tenantAdmin, { counsellorUserId, quantity: 1 }),
    ).rejects.toMatchObject({ response: { code: "REPORT_CREDIT_TRANSFER_DESTINATION_INVALID" } });
    expect(tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();
    expect(tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("derives a tenant transfer source from the session, never from the body", async () => {
    const { service, tx } = client();
    await service.transfer(
      { ...tenantAdmin, organizationId: otherOrganizationId },
      { counsellorUserId, quantity: 1, sourceWalletId: walletId },
    );
    expect(tx.commerceCreditWallet.findFirst.mock.calls[0]![0].where).toMatchObject({
      ownerType: "ORGANIZATION",
      ownerOrganizationId: otherOrganizationId,
    });
  });

  it("rejects transfers exceeding the available balance without writing ledger rows", async () => {
    const { service, tx } = client({ insufficient: true });
    await expect(
      service.transfer(tenantAdmin, { counsellorUserId, quantity: 50 }),
    ).rejects.toMatchObject({ response: { code: "REPORT_CREDIT_INSUFFICIENT_BALANCE" } });
    expect(tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.commerceCreditWallet.update).not.toHaveBeenCalled();
  });

  it("treats a replayed transfer key as idempotent and never transfers twice", async () => {
    const { service, tx } = client({ replay: true });
    const result = await service.transfer(tenantAdmin, {
      counsellorUserId,
      quantity: 2,
      transferKey,
    });
    expect(result.transferred).toBe(false);
    expect(tx.commerceCreditWallet.updateMany).not.toHaveBeenCalled();
    expect(tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
    await expect(
      service.transfer(tenantAdmin, { counsellorUserId, quantity: 3, transferKey }),
    ).rejects.toMatchObject({ response: { code: "REPORT_CREDIT_TRANSFER_KEY_REUSED" } });
  });

  it("refuses transfers from a suspended wallet and from counsellors", async () => {
    const suspended = client({ sourceStatus: "SUSPENDED" });
    await expect(
      suspended.service.transfer(tenantAdmin, { counsellorUserId, quantity: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    const { service } = client();
    await expect(
      service.transfer(
        { ...tenantAdmin, role: MembershipRole.COUNSELLOR, userId: counsellorUserId },
        { counsellorUserId, quantity: 1 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("routes legacy consumption through the derived unlock with the wallet owner as principal", async () => {
    const { service, unlocks } = client();
    unlocks.unlock.mockResolvedValue({
      status: "charged",
      grant: { id: "g" },
      ledgerEntry: { id: "l" },
    });
    const result = await service.consumeForAttempt(central, walletId, {
      attemptId: "33333333-3333-4333-8333-333333333333",
      principalType: "ORGANIZATION",
      principalOrganizationId: organizationId,
    });
    expect(result.charged).toBe(true);
    expect(unlocks.unlock).toHaveBeenCalledWith(
      central,
      expect.objectContaining({ mode: "ORGANIZATION", walletId }),
    );
    await expect(
      service.consumeForAttempt(central, walletId, {
        attemptId: "33333333-3333-4333-8333-333333333333",
        principalType: "ORGANIZATION",
        principalOrganizationId: otherOrganizationId,
      }),
    ).rejects.toMatchObject({ response: { code: "REPORT_CREDIT_PRINCIPAL_MISMATCH" } });
  });

  it("blocks closing a wallet that still holds credits", async () => {
    const { service } = client();
    await expect(
      service.setStatus(central, walletId, { status: "CLOSED", reason: "offboarded" }),
    ).rejects.toMatchObject({ response: { code: "REPORT_CREDIT_WALLET_HAS_BALANCE" } });
  });
});
