import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { OrderFulfilmentService } from "./order-fulfilment.service";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const orderId = "44444444-4444-4444-8444-444444444444";
const walletId = "55555555-5555-4555-8555-555555555555";
const actor = { actorUserId: userId, origin: "CHECKOUT" as const, source: "COUPON" };

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: orderId,
    organizationId,
    userId,
    attemptId,
    purchaserType: "CANDIDATE",
    creditWalletId: null,
    quantity: 1,
    status: "PAID",
    fulfilmentStatus: "PENDING",
    product: { kind: "REPORT", unitQuantity: 1, code: "REPORT_STD" },
    ...overrides,
  };
}

function tx(orderRow: unknown, options: { purchaseExists?: boolean; balance?: number } = {}) {
  return {
    commerceOrder: {
      findUnique: vi.fn().mockResolvedValue(orderRow),
      update: vi.fn().mockResolvedValue({}),
    },
    commerceEntitlement: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    commerceCreditWallet: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: walletId }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ status: "ACTIVE", currentBalance: options.balance ?? 0 }),
      update: vi.fn().mockResolvedValue({ currentBalance: (options.balance ?? 0) + 10 }),
    },
    commerceCreditLedgerEntry: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.purchaseExists ? { id: "purchase", walletId, quantity: 10 } : null,
        ),
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: null } }),
      create: vi.fn().mockResolvedValue({ id: "ledger" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("OrderFulfilmentService", () => {
  it("grants candidate entitlements once and marks the order fulfilled", async () => {
    const client = tx(order());
    const service = new OrderFulfilmentService();
    const result = await service.fulfil(
      client as unknown as Prisma.TransactionClient,
      orderId,
      actor,
    );

    expect(result.fulfilled).toBe(true);
    expect(client.commerceEntitlement.upsert).toHaveBeenCalledTimes(1);
    expect(client.commerceEntitlement.upsert.mock.calls[0]![0].create).toMatchObject({
      type: "REPORT",
      attemptId,
      orderId,
      source: "COUPON",
    });
    expect(client.commerceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fulfilmentStatus: "FULFILLED" }) }),
    );
    expect(client.auditLog.create).toHaveBeenCalledOnce();
  });

  it("is a no-op for an already fulfilled order", async () => {
    const client = tx(order({ fulfilmentStatus: "FULFILLED" }));
    const result = await new OrderFulfilmentService().fulfil(
      client as unknown as Prisma.TransactionClient,
      orderId,
      actor,
    );
    expect(result.alreadyFulfilled).toBe(true);
    expect(client.commerceEntitlement.upsert).not.toHaveBeenCalled();
    expect(client.commerceOrder.update).not.toHaveBeenCalled();
  });

  it("refuses to fulfil an unpaid order", async () => {
    const client = tx(order({ status: "PENDING" }));
    await expect(
      new OrderFulfilmentService().fulfil(
        client as unknown as Prisma.TransactionClient,
        orderId,
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("credits an organisation wallet for a credit pack using backend unit quantity", async () => {
    const client = tx(
      order({
        attemptId: null,
        purchaserType: "ORGANIZATION",
        quantity: 2,
        product: { kind: "REPORT_CREDIT_PACK", unitQuantity: 5, code: "PACK_5" },
      }),
    );
    await new OrderFulfilmentService().fulfil(
      client as unknown as Prisma.TransactionClient,
      orderId,
      {
        actorUserId: null,
        origin: "GATEWAY_WEBHOOK",
        source: "RAZORPAY",
      },
    );
    expect(client.commerceCreditWallet.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerType: "ORGANIZATION",
        ownerOrganizationId: organizationId,
        creditType: "REPORT_ACCESS",
      }),
    });
    expect(client.commerceCreditWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentBalance: { increment: 10 } } }),
    );
    expect(client.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "PURCHASE",
        quantity: 10,
        delta: 10,
        orderId,
        actorUserId: userId,
      }),
    });
    expect(client.commerceEntitlement.upsert).not.toHaveBeenCalled();
  });

  it("does not credit a wallet twice for the same order", async () => {
    const client = tx(
      order({
        attemptId: null,
        purchaserType: "ORGANIZATION",
        creditWalletId: walletId,
        product: { kind: "REPORT_CREDIT_PACK", unitQuantity: 5, code: "PACK_5" },
      }),
      { purchaseExists: true },
    );
    await new OrderFulfilmentService().fulfil(
      client as unknown as Prisma.TransactionClient,
      orderId,
      actor,
    );
    expect(client.commerceCreditWallet.update).not.toHaveBeenCalled();
    expect(client.commerceCreditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("reverses only unconsumed purchased credits on refund", async () => {
    const client = tx(
      order({
        attemptId: null,
        purchaserType: "ORGANIZATION",
        creditWalletId: walletId,
        fulfilmentStatus: "FULFILLED",
        product: { kind: "REPORT_CREDIT_PACK", unitQuantity: 10, code: "PACK_10" },
      }),
      { purchaseExists: true, balance: 4 },
    );
    client.commerceCreditWallet.update.mockResolvedValue({ currentBalance: 0 });
    const result = await new OrderFulfilmentService().reverse(
      client as unknown as Prisma.TransactionClient,
      orderId,
      { actorUserId: userId, origin: "ADMIN_REFUND", source: "REFUND" },
      "RF-1",
    );
    expect(result.reversedCredits).toBe(4);
    expect(client.commerceCreditWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentBalance: { decrement: 4 } } }),
    );
    expect(client.commerceCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: "REVERSAL", quantity: 4, delta: -4, orderId }),
    });
  });

  it("revokes active entitlements from a refunded candidate order", async () => {
    const client = tx(order({ fulfilmentStatus: "FULFILLED" }));
    const result = await new OrderFulfilmentService().reverse(
      client as unknown as Prisma.TransactionClient,
      orderId,
      { actorUserId: userId, origin: "ADMIN_REFUND", source: "REFUND" },
    );
    expect(result.revokedEntitlements).toBe(1);
    expect(client.commerceEntitlement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId, status: "ACTIVE" },
        data: expect.objectContaining({ status: "REVOKED" }),
      }),
    );
  });
});
