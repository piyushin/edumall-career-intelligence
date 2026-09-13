import { ConflictException, ForbiddenException } from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import type { CommercePricingService } from "./commerce-pricing.service";
import { CommerceService } from "./commerce.service";
import type { OrderFulfilmentService } from "./order-fulfilment.service";

const organizationId = "22222222-2222-4222-8222-222222222222";
const candidateId = "11111111-1111-4111-8111-111111111111";
const attemptId = "44444444-4444-4444-8444-444444444444";
const orderId = "55555555-5555-4555-8555-555555555555";

const candidate: AuthContext = {
  userId: candidateId,
  organizationId,
  membershipId: "33333333-3333-4333-8333-333333333333",
  role: MembershipRole.STUDENT,
  sessionId: "session",
};
const tenantAdmin: AuthContext = {
  ...candidate,
  userId: "66666666-6666-4666-8666-666666666666",
  role: MembershipRole.ORGANIZATION_ADMIN,
};
const central: AuthContext = {
  ...candidate,
  userId: "77777777-7777-4777-8777-777777777777",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  permissions: ["*"],
};

const product = {
  id: "product",
  code: "REPORT_STD",
  name: "Report",
  kind: "REPORT",
  organizationId: null,
  currency: "INR",
  priceMinor: 100000,
  minPriceMinor: 60000,
  maxPriceMinor: null,
  taxRateBps: null,
};

function harness(
  options: {
    coupon?: Record<string, unknown> | null;
    order?: Record<string, unknown> | null;
    organizationPolicy?: Record<string, unknown> | null;
    pendingManual?: Record<string, unknown> | null;
  } = {},
) {
  const tx = {
    commerceCoupon: { findUnique: vi.fn().mockResolvedValue(options.coupon ?? null) },
    commerceCouponRedemption: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
    commerceOrder: {
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: orderId, ...data, paidAt: data.paidAt ?? null }),
        ),
      update: vi.fn().mockResolvedValue({}),
    },
    commercePayment: {
      create: vi.fn().mockResolvedValue({ id: "payment" }),
      update: vi.fn().mockResolvedValue({ id: "payment" }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(options.pendingManual ?? null),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    assessmentAttempt: {
      findFirst: vi.fn().mockResolvedValue({
        id: attemptId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        assignment: {
          organizationId,
          assessmentVersionId: "version",
          metadata: { registrationSource: "PUBLIC_SIGNUP" },
          assessmentVersion: { title: "Career Profile" },
          user: { email: "c@example.com", firstName: "A", lastName: "B" },
        },
        scoringRuns: [],
        reportGeneration: null,
        reportReleases: [],
      }),
    },
    commerceProduct: { findFirst: vi.fn().mockResolvedValue(product) },
    commerceOrder: {
      ...tx.commerceOrder,
      findUnique: vi.fn().mockResolvedValue(options.order === undefined ? null : options.order),
    },
    commerceOrganizationPolicy: {
      findUnique: vi.fn().mockResolvedValue(options.organizationPolicy ?? null),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const fulfilment = {
    fulfil: vi.fn().mockResolvedValue({ fulfilled: true }),
    reverse: vi.fn().mockResolvedValue({ revokedEntitlements: 1, reversedCredits: 0 }),
  };
  const pricing = {
    resolvePrice: vi.fn().mockResolvedValue({
      unitPriceMinor: 80000,
      basePriceMinor: 100000,
      pricingSource: "ORGANIZATION",
      organizationPriceId: "price",
      counsellorFeeId: null,
      floorMinor: 60000,
    }),
    computeTotals: vi.fn().mockImplementation((_p, unit, qty, discount) => {
      const subtotal = unit * qty;
      const total = Math.max(0, subtotal - discount);
      return Promise.resolve({
        subtotalMinor: subtotal,
        discountMinor: Math.min(subtotal, discount),
        taxRateBps: 1800,
        taxMinor: Math.round((total * 1800) / 11800),
        totalMinor: total,
      });
    }),
    tenantCouponCapBps: vi.fn().mockResolvedValue(5000),
  };
  return {
    tx,
    prisma,
    fulfilment,
    pricing,
    service: new CommerceService(
      prisma as unknown as PrismaClient,
      fulfilment as unknown as OrderFulfilmentService,
      pricing as unknown as CommercePricingService,
    ),
  };
}

const activeCoupon = (overrides: Record<string, unknown>) => ({
  id: "coupon",
  organizationId: null,
  productId: null,
  appliesToKind: null,
  code: "SAVE",
  discountType: "PERCENTAGE",
  percentageBps: 5000,
  fixedAmountMinor: null,
  validFrom: new Date(Date.now() - 1000),
  validUntil: null,
  maxRedemptions: null,
  perUserLimit: 1,
  status: "ACTIVE",
  ...overrides,
});

describe("candidate orders: backend pricing, floors and snapshots", () => {
  it("charges the backend-resolved price and snapshots base price, source and tax", async () => {
    const { service, tx, pricing } = harness();
    const order = await service.createCandidateOrder(candidate, attemptId, {
      productCode: "REPORT_STD",
    });
    expect(pricing.resolvePrice).toHaveBeenCalledWith(tx, product, organizationId);
    expect(tx.commerceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotalMinor: 80000,
          basePriceMinor: 100000,
          pricingSource: "ORGANIZATION",
          taxRateBps: 1800,
          totalMinor: 80000,
          purchaserType: "CANDIDATE",
          attemptId,
        }),
      }),
    );
    expect(order.paymentRequired).toBe(true);
  });

  it("never lets a tenant coupon discount below the platform floor", async () => {
    const { service, tx } = harness({
      coupon: activeCoupon({ organizationId, productId: "product", percentageBps: 9000 }),
    });
    await service.createCandidateOrder(candidate, attemptId, {
      productCode: "REPORT_STD",
      couponCode: "SAVE",
    });
    // Selling price 80000, floor 60000: a 90 % tenant coupon is clamped to 20000.
    expect(tx.commerceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ discountMinor: 20000, totalMinor: 60000 }),
      }),
    );
  });

  it("lets a central free coupon take the order to zero and fulfil immediately", async () => {
    const { service, tx, fulfilment } = harness({
      coupon: activeCoupon({ discountType: "FREE", percentageBps: null }),
    });
    const order = await service.createCandidateOrder(candidate, attemptId, {
      productCode: "REPORT_STD",
      couponCode: "SAVE",
    });
    expect(order.paymentRequired).toBe(false);
    expect(tx.commerceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalMinor: 0, status: "PAID" }),
      }),
    );
    expect(fulfilment.fulfil).toHaveBeenCalledWith(
      tx,
      orderId,
      expect.objectContaining({ origin: "CHECKOUT", source: "COUPON" }),
    );
  });
});

describe("refunds: consumption rule and override", () => {
  const paidOrder = (consumedAt: Date | null) => ({
    id: orderId,
    organizationId,
    status: "PAID",
    totalMinor: 80000,
    currency: "INR",
    entitlements: [{ id: "ent", type: "REPORT", status: "ACTIVE", consumedAt }],
  });

  it("refunds an unopened report entitlement", async () => {
    const { service, fulfilment, tx } = harness({ order: paidOrder(null) });
    const result = await service.refundOrder(central, orderId, { reference: "RF-1" });
    expect(result).toMatchObject({ status: "refunded", revokedEntitlements: 1 });
    expect(fulfilment.reverse).toHaveBeenCalledOnce();
    expect(tx.commerceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED" }) }),
    );
  });

  it("blocks refunding an opened report unless a central override with reason is given", async () => {
    const consumed = paidOrder(new Date());
    const blocked = harness({ order: consumed });
    await expect(blocked.service.refundOrder(central, orderId, {})).rejects.toMatchObject({
      response: { code: "ORDER_ENTITLEMENT_CONSUMED" },
    });
    await expect(
      blocked.service.refundOrder(central, orderId, { override: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blocked.fulfilment.reverse).not.toHaveBeenCalled();

    const overridden = harness({ order: consumed });
    await overridden.service.refundOrder(central, orderId, {
      override: true,
      reason: "Duplicate purchase confirmed by finance",
    });
    expect(overridden.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "commerce.order.refunded",
        metadata: expect.objectContaining({ override: true, consumedEntitlementIds: ["ent"] }),
      }),
    });
  });

  it("is idempotent for an already refunded order", async () => {
    const { service, fulfilment } = harness({ order: { ...paidOrder(null), status: "REFUNDED" } });
    expect(await service.refundOrder(central, orderId, {})).toEqual({
      status: "refunded",
      orderId,
    });
    expect(fulfilment.reverse).not.toHaveBeenCalled();
  });
});

describe("institutional manual payments", () => {
  const organizationOrder = {
    id: orderId,
    organizationId,
    userId: tenantAdmin.userId,
    purchaserType: "ORGANIZATION",
    status: "PENDING",
    totalMinor: 250000,
    currency: "INR",
  };

  it("lets the purchasing organization record a reference only when the platform enabled it", async () => {
    const disabled = harness({ order: organizationOrder });
    await expect(
      disabled.service.submitManualPayment(tenantAdmin, orderId, {
        method: "BANK_TRANSFER",
        reference: "NEFT-123",
      }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_MANUAL_PAYMENT_DISABLED" } });

    const enabled = harness({
      order: organizationOrder,
      organizationPolicy: { manualPaymentEnabled: true },
    });
    const result = await enabled.service.submitManualPayment(tenantAdmin, orderId, {
      method: "BANK_TRANSFER",
      reference: "NEFT-123",
    });
    expect(result.status).toBe("awaiting_approval");
    expect(enabled.tx.commercePayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "MANUAL",
        status: "PENDING",
        reference: "NEFT-123",
        amountMinor: 250000,
      }),
    });
    expect(enabled.fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it("rejects references from other organizations and unsupported methods", async () => {
    const { service } = harness({
      order: organizationOrder,
      organizationPolicy: { manualPaymentEnabled: true },
    });
    await expect(
      service.submitManualPayment(
        { ...tenantAdmin, organizationId: "99999999-9999-4999-8999-999999999999" },
        orderId,
        { method: "UPI", reference: "UPI-1" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.submitManualPayment(tenantAdmin, orderId, { method: "CASH", reference: "x" }),
    ).rejects.toMatchObject({ response: { code: "MANUAL_PAYMENT_METHOD_INVALID" } });
  });

  it("central approval completes the pending reference and fulfils through the shared service", async () => {
    const { service, tx, fulfilment } = harness({
      order: { ...organizationOrder, product: { kind: "REPORT_CREDIT_PACK" } },
      pendingManual: { id: "payment", reference: "NEFT-123" },
    });
    await service.manualApproveOrder(central, orderId, { method: "BANK_TRANSFER" });
    expect(tx.commercePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment" },
        data: expect.objectContaining({
          status: "MANUAL_APPROVED",
          reference: "NEFT-123",
          approvedByUserId: central.userId,
        }),
      }),
    );
    expect(tx.commercePayment.create).not.toHaveBeenCalled();
    expect(fulfilment.fulfil).toHaveBeenCalledWith(
      tx,
      orderId,
      expect.objectContaining({ origin: "MANUAL_APPROVAL" }),
    );
    await expect(
      service.manualApproveOrder(tenantAdmin, orderId, { method: "BANK_TRANSFER" }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_CENTRAL_ONLY" } });
  });
});
