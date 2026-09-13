import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import type { CommercePricingService } from "./commerce-pricing.service";
import { CommerceService } from "./commerce.service";
import type { OrderFulfilmentService } from "./order-fulfilment.service";

const organizationId = "22222222-2222-4222-8222-222222222222";
const central: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: null,
  membershipId: null,
  role: MembershipRole.SUPER_ADMIN,
  sessionId: "session",
  permissions: ["*"],
};
const tenantAdmin: AuthContext = {
  ...central,
  organizationId,
  membershipId: "33333333-3333-4333-8333-333333333333",
  role: MembershipRole.ORGANIZATION_ADMIN,
  permissions: [],
};

function setup(
  product: Record<string, unknown> | null = null,
  options: { capBps?: number; couponsEnabled?: boolean } = {},
) {
  const prisma = {
    commerceProduct: {
      findUnique: vi.fn().mockResolvedValue(product),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "product", ...data })),
    },
    commerceCoupon: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "coupon", ...data })),
    },
    commerceOrder: {
      findUnique: vi.fn().mockResolvedValue({
        id: "order",
        organizationId,
        status: "PENDING",
        product: { kind: "REPORT" },
      }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  const fulfilment = { fulfil: vi.fn(), reverse: vi.fn() };
  const pricing = {
    tenantCouponCapBps: vi
      .fn()
      .mockImplementation(() =>
        options.couponsEnabled === false
          ? Promise.reject(new ForbiddenException({ code: "COMMERCE_TENANT_COUPONS_DISABLED" }))
          : Promise.resolve(options.capBps ?? 5000),
      ),
    resolvePrice: vi.fn(),
    computeTotals: vi.fn(),
  };
  return {
    prisma,
    pricing,
    service: new CommerceService(
      prisma as unknown as PrismaClient,
      fulfilment as unknown as OrderFulfilmentService,
      pricing as unknown as CommercePricingService,
    ),
  };
}

const limits = { validUntil: "2027-01-01T00:00:00.000Z", maxRedemptions: 100 };

const boundProduct = {
  id: "product",
  organizationId,
  priceMinor: 100000,
  kind: "REPORT",
};

describe("commerce authority boundaries (R20-C2a)", () => {
  it("lets central administrators create free coupons", async () => {
    const { service, prisma } = setup();
    await service.createCoupon(central, { code: "free1", discountType: "FREE" });
    expect(prisma.commerceCoupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "FREE1", discountType: "FREE", organizationId: null }),
    });
  });

  it("refuses free coupons from tenant administrators", async () => {
    const { service, prisma } = setup(boundProduct);
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "tenantfree",
        discountType: "FREE",
        productCode: "REPORT_STD",
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_FREE_CENTRAL_ONLY" } });
    expect(prisma.commerceCoupon.create).not.toHaveBeenCalled();
  });

  it("requires tenant coupons to be product-bound and within the platform cap", async () => {
    const { service, prisma } = setup(boundProduct);
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "unbound",
        discountType: "PERCENTAGE",
        percentageBps: 1000,
        ...limits,
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_PRODUCT_REQUIRED" } });
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "toobig",
        discountType: "PERCENTAGE",
        percentageBps: 7500,
        productCode: "REPORT_STD",
        ...limits,
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_DISCOUNT_EXCEEDS_CAP" } });
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "fixedbig",
        discountType: "FIXED",
        fixedAmountMinor: 60000,
        productCode: "REPORT_STD",
        ...limits,
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_DISCOUNT_EXCEEDS_CAP" } });
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "nolimits",
        discountType: "PERCENTAGE",
        percentageBps: 2000,
        productCode: "REPORT_STD",
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_LIMITS_REQUIRED" } });

    await service.createCoupon(tenantAdmin, {
      code: "ok20",
      discountType: "PERCENTAGE",
      percentageBps: 2000,
      productCode: "REPORT_STD",
      ...limits,
    });
    expect(prisma.commerceCoupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "OK20", organizationId, productId: "product" }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "commerce.coupon.created" }),
    });
  });

  it("uses the platform/organization policy cap rather than a hardcoded percentage", async () => {
    const { service, pricing } = setup(boundProduct, { capBps: 1000 });
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "cap",
        discountType: "PERCENTAGE",
        percentageBps: 2000,
        productCode: "REPORT_STD",
        ...limits,
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_DISCOUNT_EXCEEDS_CAP" } });
    expect(pricing.tenantCouponCapBps).toHaveBeenCalledWith(organizationId);
  });

  it("refuses tenant coupons entirely when the platform has not enabled them", async () => {
    const { service } = setup(boundProduct, { couponsEnabled: false });
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "off",
        discountType: "PERCENTAGE",
        percentageBps: 500,
        productCode: "REPORT_STD",
        ...limits,
      }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_TENANT_COUPONS_DISABLED" } });
  });

  it("never lets a tenant coupon discount report-credit packs", async () => {
    const { service } = setup({ ...boundProduct, kind: "REPORT_CREDIT_PACK" });
    await expect(
      service.createCoupon(tenantAdmin, {
        code: "packs",
        discountType: "PERCENTAGE",
        percentageBps: 500,
        productCode: "PACK_5",
        ...limits,
      }),
    ).rejects.toMatchObject({ response: { code: "COUPON_CREDIT_PACK_CENTRAL_ONLY" } });
  });

  it("keeps manual payment approval central-only", async () => {
    const { service, prisma } = setup();
    await expect(
      service.manualApproveOrder(tenantAdmin, "order", { method: "CASH" }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_CENTRAL_ONLY" } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("keeps cancel, refund and fulfilment retry central-only", async () => {
    const { service } = setup();
    await expect(service.cancelOrder(tenantAdmin, "order", {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.refundOrder(tenantAdmin, "order", {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.retryFulfilment(tenantAdmin, "order")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("requires credit packs to target organisations or counsellors and records price audit", async () => {
    const { service, prisma } = setup();
    await expect(
      service.createProduct(central, {
        code: "pack5",
        name: "5 credits",
        kind: "REPORT_CREDIT_PACK",
        priceMinor: 250000,
        unitQuantity: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createProduct(central, {
        code: "report",
        name: "Report",
        kind: "REPORT",
        audience: "ORGANIZATION",
        priceMinor: 49900,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.createProduct(central, {
      code: "pack5",
      name: "5 credits",
      kind: "REPORT_CREDIT_PACK",
      audience: "ORGANIZATION",
      priceMinor: 250000,
      unitQuantity: 5,
    });
    expect(prisma.commerceProduct.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ audience: "ORGANIZATION", unitQuantity: 5 }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "commerce.product.created",
        metadata: expect.objectContaining({ priceMinor: 250000 }),
      }),
    });
  });
});
