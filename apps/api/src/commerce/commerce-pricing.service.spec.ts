import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { CommerceProductKind, MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { CommercePricingService } from "./commerce-pricing.service";

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
const counsellor: AuthContext = {
  ...tenantAdmin,
  userId: "44444444-4444-4444-8444-444444444444",
  role: MembershipRole.COUNSELLOR,
};

const product = {
  id: "product",
  code: "REPORT_STD",
  kind: CommerceProductKind.REPORT,
  organizationId: null,
  priceMinor: 100000,
  minPriceMinor: 60000,
  maxPriceMinor: 150000,
  taxRateBps: null,
  status: "ACTIVE",
};

function setup(
  options: {
    platform?: Record<string, unknown>;
    organizationPolicy?: Record<string, unknown> | null;
    organizationPrice?: Record<string, unknown> | null;
    counsellorFee?: Record<string, unknown> | null;
    product?: Record<string, unknown> | null;
  } = {},
) {
  const platform = {
    id: "DEFAULT",
    tenantCouponMaxDiscountBps: 5000,
    defaultTaxRateBps: 1800,
    taxInclusivePricing: true,
    counsellorFeePricingEnabled: false,
    counsellorFeeMinMinor: 50000,
    counsellorFeeMaxMinor: 300000,
    ...options.platform,
  };
  const prisma = {
    commercePlatformPolicy: {
      upsert: vi.fn().mockResolvedValue(platform),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...platform, ...data })),
    },
    commerceOrganizationPolicy: {
      findUnique: vi.fn().mockResolvedValue(options.organizationPolicy ?? null),
      upsert: vi
        .fn()
        .mockImplementation(({ create }) => Promise.resolve({ id: "policy", ...create })),
    },
    commerceOrganizationPrice: {
      findFirst: vi.fn().mockResolvedValue(options.organizationPrice ?? null),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi
        .fn()
        .mockImplementation(({ create }) => Promise.resolve({ id: "price", ...create })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    commerceCounsellorFee: {
      findFirst: vi.fn().mockResolvedValue(options.counsellorFee ?? null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ id: "fee", ...create })),
    },
    commerceProduct: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.product === undefined ? product : options.product),
    },
    organization: { findUnique: vi.fn().mockResolvedValue({ id: organizationId }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return { prisma, service: new CommercePricingService(prisma as unknown as PrismaClient) };
}

describe("CommercePricingService", () => {
  it("charges the platform base price when no delegated tenant price applies", async () => {
    const { prisma, service } = setup();
    const resolved = await service.resolvePrice(
      prisma as unknown as PrismaClient,
      product,
      organizationId,
    );
    expect(resolved).toMatchObject({
      unitPriceMinor: 100000,
      basePriceMinor: 100000,
      pricingSource: "PLATFORM",
      floorMinor: 60000,
    });
  });

  it("honours a tenant selling price only while delegation is enabled and inside bounds", async () => {
    const delegated = setup({
      organizationPolicy: { delegatedPricingEnabled: true },
      organizationPrice: { id: "price", sellingPriceMinor: 80000 },
    });
    expect(
      await delegated.service.resolvePrice(
        delegated.prisma as unknown as PrismaClient,
        product,
        organizationId,
      ),
    ).toMatchObject({
      unitPriceMinor: 80000,
      pricingSource: "ORGANIZATION",
      basePriceMinor: 100000,
    });

    const revoked = setup({
      organizationPolicy: { delegatedPricingEnabled: false },
      organizationPrice: { id: "price", sellingPriceMinor: 80000 },
    });
    expect(
      await revoked.service.resolvePrice(
        revoked.prisma as unknown as PrismaClient,
        product,
        organizationId,
      ),
    ).toMatchObject({ unitPriceMinor: 100000, pricingSource: "PLATFORM" });

    const belowFloor = setup({
      organizationPolicy: { delegatedPricingEnabled: true },
      organizationPrice: { id: "price", sellingPriceMinor: 10000 },
    });
    expect(
      await belowFloor.service.resolvePrice(
        belowFloor.prisma as unknown as PrismaClient,
        product,
        organizationId,
      ),
    ).toMatchObject({ unitPriceMinor: 100000, pricingSource: "PLATFORM" });
  });

  it("refuses tenant prices when delegation is off, out of bounds, zero, or on credit packs", async () => {
    const off = setup({ organizationPolicy: { delegatedPricingEnabled: false } });
    await expect(
      off.service.setOrganizationPrice(tenantAdmin, {
        productCode: "REPORT_STD",
        sellingPriceMinor: 80000,
      }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_DELEGATED_PRICING_DISABLED" } });

    const on = setup({ organizationPolicy: { delegatedPricingEnabled: true } });
    await expect(
      on.service.setOrganizationPrice(tenantAdmin, {
        productCode: "REPORT_STD",
        sellingPriceMinor: 10000,
      }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_PRICE_OUT_OF_BOUNDS" } });
    await expect(
      on.service.setOrganizationPrice(tenantAdmin, {
        productCode: "REPORT_STD",
        sellingPriceMinor: 200000,
      }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_PRICE_OUT_OF_BOUNDS" } });
    await expect(
      on.service.setOrganizationPrice(tenantAdmin, {
        productCode: "REPORT_STD",
        sellingPriceMinor: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const pack = setup({
      organizationPolicy: { delegatedPricingEnabled: true },
      product: { ...product, kind: "REPORT_CREDIT_PACK" },
    });
    await expect(
      pack.service.setOrganizationPrice(tenantAdmin, {
        productCode: "PACK",
        sellingPriceMinor: 80000,
      }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_PRICE_NOT_DELEGABLE" } });

    await on.service.setOrganizationPrice(tenantAdmin, {
      productCode: "REPORT_STD",
      sellingPriceMinor: 80000,
    });
    expect(on.prisma.commerceOrganizationPrice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ organizationId, sellingPriceMinor: 80000 }),
      }),
    );
    expect(on.prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "commerce.price.organization.set", organizationId }),
    });
  });

  it("never lets a tenant admin price another organization", async () => {
    const { service } = setup({ organizationPolicy: { delegatedPricingEnabled: true } });
    await expect(
      service.setOrganizationPrice(
        { ...tenantAdmin, organizationId: "99999999-9999-4999-8999-999999999999" },
        { organizationId, productCode: "REPORT_STD", sellingPriceMinor: 80000 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("restricts counsellor fees to enabled pricing, counselling products and platform bounds", async () => {
    const disabled = setup({ product: { ...product, kind: "COUNSELLING" } });
    await expect(
      disabled.service.setCounsellorFee(counsellor, { productCode: "COUNSEL", feeMinor: 100000 }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_COUNSELLOR_FEE_DISABLED" } });

    const report = setup({ platform: { counsellorFeePricingEnabled: true } });
    await expect(
      report.service.setCounsellorFee(counsellor, { productCode: "REPORT_STD", feeMinor: 100000 }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_PRICE_NOT_DELEGABLE" } });

    const enabled = setup({
      platform: { counsellorFeePricingEnabled: true },
      product: { ...product, kind: "COUNSELLING" },
    });
    await expect(
      enabled.service.setCounsellorFee(counsellor, { productCode: "COUNSEL", feeMinor: 400000 }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_PRICE_OUT_OF_BOUNDS" } });
    await enabled.service.setCounsellorFee(counsellor, {
      productCode: "COUNSEL",
      feeMinor: 120000,
    });
    expect(enabled.prisma.commerceCounsellorFee.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ counsellorUserId: counsellor.userId, feeMinor: 120000 }),
      }),
    );
    await expect(
      enabled.service.setCounsellorFee(tenantAdmin, { productCode: "COUNSEL", feeMinor: 120000 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("resolves a counsellor fee for counselling products when enabled", async () => {
    const { prisma, service } = setup({
      platform: { counsellorFeePricingEnabled: true },
      counsellorFee: { id: "fee", feeMinor: 120000 },
    });
    const resolved = await service.resolvePrice(
      prisma as unknown as PrismaClient,
      { ...product, kind: CommerceProductKind.COUNSELLING },
      organizationId,
      counsellor.userId,
    );
    expect(resolved).toMatchObject({ unitPriceMinor: 120000, pricingSource: "COUNSELLOR" });
  });

  it("computes inclusive and exclusive tax from backend policy", async () => {
    const inclusive = setup();
    expect(await inclusive.service.computeTotals(product, 100000, 1, 20000)).toEqual({
      subtotalMinor: 100000,
      discountMinor: 20000,
      taxRateBps: 1800,
      taxMinor: 12203,
      totalMinor: 80000,
    });
    const exclusive = setup({ platform: { taxInclusivePricing: false } });
    expect(await exclusive.service.computeTotals({ taxRateBps: 500 }, 100000, 2, 0)).toEqual({
      subtotalMinor: 200000,
      discountMinor: 0,
      taxRateBps: 500,
      taxMinor: 10000,
      totalMinor: 210000,
    });
  });

  it("derives the tenant coupon cap from platform and organization policy", async () => {
    const off = setup({ organizationPolicy: { couponsEnabled: false } });
    await expect(off.service.tenantCouponCapBps(organizationId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const capped = setup({
      organizationPolicy: { couponsEnabled: true, couponMaxDiscountBps: 2000 },
    });
    expect(await capped.service.tenantCouponCapBps(organizationId)).toBe(2000);
    const above = setup({
      organizationPolicy: { couponsEnabled: true, couponMaxDiscountBps: 9000 },
    });
    expect(await above.service.tenantCouponCapBps(organizationId)).toBe(5000);
  });

  it("keeps platform and organization policy changes central-only and audited", async () => {
    const { service, prisma } = setup();
    await expect(
      service.updatePlatformPolicy(tenantAdmin, { tenantCouponMaxDiscountBps: 100 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updatePlatformPolicy(
        { ...central, organizationId, role: MembershipRole.PLATFORM_ADMIN },
        { tenantCouponMaxDiscountBps: 100 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.updatePlatformPolicy(central, { tenantCouponMaxDiscountBps: 100 });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "commerce.policy.platform.updated" }),
    });
    await expect(
      service.updateOrganizationPolicy(tenantAdmin, organizationId, {
        delegatedPricingEnabled: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.updateOrganizationPolicy(central, organizationId, {
      delegatedPricingEnabled: true,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "commerce.policy.organization.updated",
        organizationId,
      }),
    });
    await expect(
      service.updateOrganizationPolicy(central, organizationId, { couponMaxDiscountBps: 9000 }),
    ).rejects.toMatchObject({ response: { code: "COMMERCE_POLICY_BOUNDS_INVALID" } });
  });
});
