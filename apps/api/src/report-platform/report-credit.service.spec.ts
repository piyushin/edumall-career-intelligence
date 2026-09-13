import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  CommerceCreditWalletOwnerType,
  CommerceCreditWalletStatus,
  CommerceReportPrincipalType,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { ReportCreditService } from "./report-credit.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const walletId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const context: AuthContext = {
  userId: "44444444-4444-4444-8444-444444444444",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "session",
  permissions: ["*"],
};
const wallet = {
  id: walletId,
  ownerType: CommerceCreditWalletOwnerType.ORGANIZATION,
  ownerUserId: null,
  ownerOrganizationId: organizationId,
  creditType: "REPORT_ACCESS",
  status: CommerceCreditWalletStatus.ACTIVE,
  currentBalance: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function client(options: { insufficient?: boolean } = {}) {
  let grant: unknown = null;
  const tx = {
    commerceCreditWallet: {
      findFirst: vi.fn().mockResolvedValue(wallet),
      update: vi.fn().mockResolvedValue({ currentBalance: 4 }),
      updateMany: vi.fn().mockResolvedValue({ count: options.insufficient ? 0 : 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ currentBalance: 1 }),
    },
    commerceCreditLedgerEntry: {
      create: vi.fn().mockResolvedValue({ id: "ledger", walletId, delta: -1, balanceAfter: 1 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    commerceReportAccessGrant: {
      findFirst: vi.fn().mockImplementation(() => Promise.resolve(grant)),
      create: vi.fn().mockImplementation((args) => {
        return Promise.resolve({ id: "grant", ...args.data });
      }),
      update: vi.fn().mockImplementation((args) => {
        grant = {
          id: "grant",
          ...args.data,
          creditLedgerEntry: { id: "ledger" },
        };
        return Promise.resolve(grant);
      }),
    },
    assessmentAttempt: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ assignment: { organizationId, userId: "candidate" } }),
    },
    candidateCounsellorAssignment: { findFirst: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(
      async (callback: (client: typeof tx) => unknown, _transactionOptions: unknown) =>
        callback(tx),
    ),
  };
  return { prisma, tx };
}

const consumption = {
  attemptId,
  principalType: CommerceReportPrincipalType.ORGANIZATION,
  principalOrganizationId: organizationId,
};

describe("ReportCreditService", () => {
  it("allots credits by updating the cache and appending a ledger entry with audit evidence", async () => {
    const { prisma, tx } = client();
    const result = await new ReportCreditService(prisma as unknown as PrismaClient).allot(
      context,
      walletId,
      2,
      "complimentary",
    );
    expect(tx.commerceCreditWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentBalance: { increment: 2 } } }),
    );
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "ADMIN_ALLOTMENT",
        quantity: 2,
        delta: 2,
        balanceAfter: 4,
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(result.balance).toBe(4);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("refuses complimentary allotment and revocation from tenant administrators", async () => {
    const { prisma, tx } = client();
    const service = new ReportCreditService(prisma as unknown as PrismaClient);
    const tenantAdmin: AuthContext = {
      ...context,
      organizationId,
      role: MembershipRole.ORGANIZATION_ADMIN,
      permissions: ["report.credit.manage"],
    };
    await expect(service.allot(tenantAdmin, walletId, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.revokeUnusedAdminCredits(tenantAdmin, walletId, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.commerceCreditWallet.update).not.toHaveBeenCalled();
    expect(tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("still lets tenant administrators consume credits they already hold", async () => {
    const { prisma, tx } = client();
    const tenantAdmin: AuthContext = {
      ...context,
      organizationId,
      role: MembershipRole.ORGANIZATION_ADMIN,
      permissions: ["report.credit.manage"],
    };
    const result = await new ReportCreditService(
      prisma as unknown as PrismaClient,
    ).consumeForAttempt(tenantAdmin, walletId, consumption);
    expect(result.charged).toBe(true);
    expect(tx.commerceCreditWallet.updateMany).toHaveBeenCalledOnce();
  });

  it("cannot consume into a negative wallet balance", async () => {
    const { prisma, tx } = client({ insufficient: true });
    await expect(
      new ReportCreditService(prisma as unknown as PrismaClient).consumeForAttempt(
        context,
        walletId,
        consumption,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.commerceReportAccessGrant.update).not.toHaveBeenCalled();
  });

  it("charges once and creates its report grant atomically on the same transaction", async () => {
    const { prisma, tx } = client();
    const service = new ReportCreditService(prisma as unknown as PrismaClient);
    const first = await service.consumeForAttempt(context, walletId, consumption);
    const duplicate = await service.consumeForAttempt(context, walletId, consumption);
    expect(first.charged).toBe(true);
    expect(duplicate.charged).toBe(false);
    expect(tx.commerceCreditWallet.updateMany).toHaveBeenCalledOnce();
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledOnce();
    expect(tx.commerceReportAccessGrant.create).toHaveBeenCalledOnce();
    expect(tx.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reportAccessGrantId: "grant", attemptId }),
    });
    expect(tx.commerceReportAccessGrant.update).toHaveBeenCalledWith({
      where: { id: "grant" },
      data: { creditLedgerEntryId: "ledger" },
    });
  });
});
