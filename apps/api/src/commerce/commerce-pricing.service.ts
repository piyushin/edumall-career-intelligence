import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CommercePriceStatus,
  CommercePricingSource,
  CommerceProductKind,
  CommerceProductStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { isPlatformAdministrator } from "../auth/authorization-context";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  SetCounsellorFeeDto,
  SetOrganizationPriceDto,
  UpdateOrganizationPolicyDto,
  UpdatePlatformPolicyDto,
} from "./commerce.types";

const PLATFORM_POLICY_ID = "DEFAULT";

export interface PriceableProduct {
  id: string;
  kind: CommerceProductKind;
  organizationId: string | null;
  priceMinor: number;
  minPriceMinor: number;
  maxPriceMinor: number | null;
  taxRateBps: number | null;
}

export interface ResolvedPrice {
  unitPriceMinor: number;
  basePriceMinor: number;
  pricingSource: CommercePricingSource;
  organizationPriceId: string | null;
  counsellorFeeId: string | null;
  floorMinor: number;
}

export interface OrderTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
}

// Backend authority for every amount a buyer is charged. The platform owns base
// price, floor, ceiling, tax policy and delegation; tenants and counsellors may
// only move inside the bounds the platform grants them.
@Injectable()
export class CommercePricingService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async getPlatformPolicy() {
    return this.prisma.commercePlatformPolicy.upsert({
      where: { id: PLATFORM_POLICY_ID },
      create: { id: PLATFORM_POLICY_ID },
      update: {},
    });
  }

  public async updatePlatformPolicy(context: AuthContext, input: UpdatePlatformPolicyDto) {
    // Platform-wide policy needs a platform-scoped session, not merely a central role.
    if (!isPlatformAdministrator(context)) this.denied();
    const before = await this.getPlatformPolicy();
    if (
      input.counsellorFeeMaxMinor !== undefined &&
      input.counsellorFeeMaxMinor !== null &&
      input.counsellorFeeMaxMinor < (input.counsellorFeeMinMinor ?? before.counsellorFeeMinMinor)
    ) {
      throw new BadRequestException({
        code: "COMMERCE_POLICY_BOUNDS_INVALID",
        message: "Counsellor fee ceiling must not be below the floor.",
      });
    }
    const after = await this.prisma.commercePlatformPolicy.update({
      where: { id: PLATFORM_POLICY_ID },
      data: { ...this.defined(input), updatedByUserId: context.userId },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: null,
        actorUserId: context.userId,
        action: "commerce.policy.platform.updated",
        entityType: "CommercePlatformPolicy",
        entityId: null,
        metadata: { before: this.policySnapshot(before), after: this.policySnapshot(after) },
      },
    });
    return after;
  }

  public async getOrganizationPolicy(context: AuthContext, organizationId: string) {
    this.assertOrganizationScope(context, organizationId);
    const policy = await this.prisma.commerceOrganizationPolicy.findUnique({
      where: { organizationId },
    });
    return (
      policy ?? {
        organizationId,
        delegatedPricingEnabled: false,
        couponsEnabled: false,
        couponMaxDiscountBps: null,
        manualPaymentEnabled: false,
      }
    );
  }

  public async updateOrganizationPolicy(
    context: AuthContext,
    organizationId: string,
    input: UpdateOrganizationPolicyDto,
  ) {
    this.assertCentral(context);
    this.assertOrganizationScope(context, organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException({
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }
    const platform = await this.getPlatformPolicy();
    if (
      input.couponMaxDiscountBps !== undefined &&
      input.couponMaxDiscountBps !== null &&
      input.couponMaxDiscountBps > platform.tenantCouponMaxDiscountBps
    ) {
      throw new BadRequestException({
        code: "COMMERCE_POLICY_BOUNDS_INVALID",
        message: "An organization coupon cap cannot exceed the platform tenant cap.",
      });
    }
    const before = await this.prisma.commerceOrganizationPolicy.findUnique({
      where: { organizationId },
    });
    const after = await this.prisma.commerceOrganizationPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...this.defined(input), updatedByUserId: context.userId },
      update: { ...this.defined(input), updatedByUserId: context.userId },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: context.userId,
        action: "commerce.policy.organization.updated",
        entityType: "CommerceOrganizationPolicy",
        entityId: after.id,
        metadata: {
          before: before ? this.organizationPolicySnapshot(before) : null,
          after: this.organizationPolicySnapshot(after),
        },
      },
    });
    return after;
  }

  public async listOrganizationPrices(context: AuthContext, organizationId?: string) {
    const scoped = isPlatformAdministrator(context) ? organizationId : context.organizationId;
    if (!isPlatformAdministrator(context)) this.assertOrganizationScope(context, scoped ?? "");
    return this.prisma.commerceOrganizationPrice.findMany({
      where: scoped ? { organizationId: scoped } : {},
      orderBy: [{ organizationId: "asc" }, { updatedAt: "desc" }],
      include: {
        product: {
          select: {
            code: true,
            name: true,
            kind: true,
            priceMinor: true,
            minPriceMinor: true,
            maxPriceMinor: true,
            currency: true,
          },
        },
      },
    });
  }

  // Tenant selling price: own organization only, delegated pricing must be
  // enabled by the platform, never zero, always within the platform bounds.
  // Central administrators may set it on a tenant's behalf under the same bounds.
  public async setOrganizationPrice(context: AuthContext, input: SetOrganizationPriceDto) {
    const central = isPlatformAdministrator(context);
    const organizationId = central ? input.organizationId : context.organizationId;
    if (!organizationId) {
      throw new BadRequestException({
        code: "ORGANIZATION_REQUIRED",
        message: "organizationId is required for platform administrators.",
      });
    }
    if (input.organizationId && input.organizationId !== organizationId) {
      this.assertOrganizationScope(context, input.organizationId);
    }
    this.assertOrganizationScope(context, organizationId);
    if (!central) {
      if (context.role !== MembershipRole.ORGANIZATION_ADMIN) this.denied();
      const policy = await this.prisma.commerceOrganizationPolicy.findUnique({
        where: { organizationId },
        select: { delegatedPricingEnabled: true },
      });
      if (!policy?.delegatedPricingEnabled) {
        throw new ForbiddenException({
          code: "COMMERCE_DELEGATED_PRICING_DISABLED",
          message: "Delegated pricing is not enabled for this organization.",
        });
      }
    }
    const product = await this.prisma.commerceProduct.findUnique({
      where: { code: input.productCode.trim().toUpperCase() },
      select: {
        id: true,
        kind: true,
        organizationId: true,
        priceMinor: true,
        minPriceMinor: true,
        maxPriceMinor: true,
        status: true,
      },
    });
    if (
      !product ||
      product.status !== CommerceProductStatus.ACTIVE ||
      (product.organizationId !== null && product.organizationId !== organizationId)
    ) {
      throw new NotFoundException({
        code: "COMMERCE_PRODUCT_NOT_FOUND",
        message: "Product not available to this organization.",
      });
    }
    if (product.kind === CommerceProductKind.REPORT_CREDIT_PACK) {
      throw new ForbiddenException({
        code: "COMMERCE_PRICE_NOT_DELEGABLE",
        message: "Report-credit cost is set by the platform only.",
      });
    }
    this.assertWithinBounds(input.sellingPriceMinor, product.minPriceMinor, product.maxPriceMinor);

    const before = await this.prisma.commerceOrganizationPrice.findUnique({
      where: { organizationId_productId: { organizationId, productId: product.id } },
      select: { sellingPriceMinor: true, status: true },
    });
    const price = await this.prisma.commerceOrganizationPrice.upsert({
      where: { organizationId_productId: { organizationId, productId: product.id } },
      create: {
        organizationId,
        productId: product.id,
        sellingPriceMinor: input.sellingPriceMinor,
        status: input.status ?? CommercePriceStatus.ACTIVE,
        setByUserId: context.userId,
      },
      update: {
        sellingPriceMinor: input.sellingPriceMinor,
        status: input.status ?? CommercePriceStatus.ACTIVE,
        setByUserId: context.userId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: context.userId,
        action: "commerce.price.organization.set",
        entityType: "CommerceOrganizationPrice",
        entityId: price.id,
        metadata: {
          productId: product.id,
          basePriceMinor: product.priceMinor,
          before,
          after: { sellingPriceMinor: price.sellingPriceMinor, status: price.status },
          central,
        },
      },
    });
    return price;
  }

  public async getCounsellorFees(context: AuthContext) {
    if (context.role !== MembershipRole.COUNSELLOR || !context.organizationId) this.denied();
    const policy = await this.getPlatformPolicy();
    const fees = await this.prisma.commerceCounsellorFee.findMany({
      where: { counsellorUserId: context.userId, organizationId: context.organizationId },
      include: { product: { select: { code: true, name: true, kind: true, currency: true } } },
    });
    return {
      enabled: policy.counsellorFeePricingEnabled,
      minMinor: policy.counsellorFeeMinMinor,
      maxMinor: policy.counsellorFeeMaxMinor,
      fees,
    };
  }

  // Counsellor professional fee: own fee, counselling products only, inside the
  // platform bounds, and only while the platform has enabled counsellor pricing.
  public async setCounsellorFee(context: AuthContext, input: SetCounsellorFeeDto) {
    if (context.role !== MembershipRole.COUNSELLOR || !context.organizationId) this.denied();
    const organizationId = context.organizationId;
    const policy = await this.getPlatformPolicy();
    if (!policy.counsellorFeePricingEnabled) {
      throw new ForbiddenException({
        code: "COMMERCE_COUNSELLOR_FEE_DISABLED",
        message: "Counsellor fee pricing is not enabled by the platform.",
      });
    }
    const product = await this.prisma.commerceProduct.findUnique({
      where: { code: input.productCode.trim().toUpperCase() },
      select: { id: true, kind: true, organizationId: true, status: true },
    });
    if (
      !product ||
      product.status !== CommerceProductStatus.ACTIVE ||
      (product.organizationId !== null && product.organizationId !== organizationId)
    ) {
      throw new NotFoundException({
        code: "COMMERCE_PRODUCT_NOT_FOUND",
        message: "Counselling product not available to this organization.",
      });
    }
    if (product.kind !== CommerceProductKind.COUNSELLING) {
      throw new ForbiddenException({
        code: "COMMERCE_PRICE_NOT_DELEGABLE",
        message: "Counsellors may only set fees on counselling products.",
      });
    }
    this.assertWithinBounds(
      input.feeMinor,
      policy.counsellorFeeMinMinor,
      policy.counsellorFeeMaxMinor,
    );
    const fee = await this.prisma.commerceCounsellorFee.upsert({
      where: {
        counsellorUserId_organizationId_productId: {
          counsellorUserId: context.userId,
          organizationId,
          productId: product.id,
        },
      },
      create: {
        counsellorUserId: context.userId,
        organizationId,
        productId: product.id,
        feeMinor: input.feeMinor,
        status: input.status ?? CommercePriceStatus.ACTIVE,
      },
      update: { feeMinor: input.feeMinor, status: input.status ?? CommercePriceStatus.ACTIVE },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: context.userId,
        action: "commerce.price.counsellor_fee.set",
        entityType: "CommerceCounsellorFee",
        entityId: fee.id,
        metadata: { productId: product.id, feeMinor: fee.feeMinor, status: fee.status },
      },
    });
    return fee;
  }

  public async resolvePrice(
    client: PrismaClient | Prisma.TransactionClient,
    product: PriceableProduct,
    organizationId: string,
    counsellorUserId?: string | null,
  ): Promise<ResolvedPrice> {
    const base: ResolvedPrice = {
      unitPriceMinor: product.priceMinor,
      basePriceMinor: product.priceMinor,
      pricingSource: CommercePricingSource.PLATFORM,
      organizationPriceId: null,
      counsellorFeeId: null,
      floorMinor: product.minPriceMinor,
    };
    if (product.kind === CommerceProductKind.REPORT_CREDIT_PACK) return base;

    if (counsellorUserId && product.kind === CommerceProductKind.COUNSELLING) {
      const platform = await this.getPlatformPolicy();
      if (platform.counsellorFeePricingEnabled) {
        const fee = await client.commerceCounsellorFee.findFirst({
          where: {
            counsellorUserId,
            organizationId,
            productId: product.id,
            status: CommercePriceStatus.ACTIVE,
          },
          select: { id: true, feeMinor: true },
        });
        if (
          fee &&
          fee.feeMinor >= platform.counsellorFeeMinMinor &&
          (platform.counsellorFeeMaxMinor === null ||
            fee.feeMinor <= platform.counsellorFeeMaxMinor)
        ) {
          return {
            ...base,
            unitPriceMinor: fee.feeMinor,
            pricingSource: CommercePricingSource.COUNSELLOR,
            counsellorFeeId: fee.id,
          };
        }
      }
    }

    const [policy, price] = await Promise.all([
      client.commerceOrganizationPolicy.findUnique({
        where: { organizationId },
        select: { delegatedPricingEnabled: true },
      }),
      client.commerceOrganizationPrice.findFirst({
        where: { organizationId, productId: product.id, status: CommercePriceStatus.ACTIVE },
        select: { id: true, sellingPriceMinor: true },
      }),
    ]);
    // A tenant price is honoured only while delegation is on and the price is
    // still inside the current platform bounds; otherwise the base price applies.
    if (
      policy?.delegatedPricingEnabled &&
      price &&
      price.sellingPriceMinor > 0 &&
      price.sellingPriceMinor >= product.minPriceMinor &&
      (product.maxPriceMinor === null || price.sellingPriceMinor <= product.maxPriceMinor)
    ) {
      return {
        ...base,
        unitPriceMinor: price.sellingPriceMinor,
        pricingSource: CommercePricingSource.ORGANIZATION,
        organizationPriceId: price.id,
      };
    }
    return base;
  }

  public async computeTotals(
    product: { taxRateBps: number | null },
    unitPriceMinor: number,
    quantity: number,
    discountMinor: number,
  ): Promise<OrderTotals> {
    const platform = await this.getPlatformPolicy();
    const taxRateBps = product.taxRateBps ?? platform.defaultTaxRateBps;
    const subtotalMinor = unitPriceMinor * quantity;
    const discounted = Math.max(0, subtotalMinor - Math.min(subtotalMinor, discountMinor));
    if (platform.taxInclusivePricing) {
      return {
        subtotalMinor,
        discountMinor: Math.min(subtotalMinor, discountMinor),
        taxRateBps,
        taxMinor: Math.round((discounted * taxRateBps) / (10000 + taxRateBps)),
        totalMinor: discounted,
      };
    }
    const taxMinor = Math.round((discounted * taxRateBps) / 10000);
    return {
      subtotalMinor,
      discountMinor: Math.min(subtotalMinor, discountMinor),
      taxRateBps,
      taxMinor,
      totalMinor: discounted + taxMinor,
    };
  }

  public async tenantCouponCapBps(organizationId: string): Promise<number> {
    const [platform, policy] = await Promise.all([
      this.getPlatformPolicy(),
      this.prisma.commerceOrganizationPolicy.findUnique({
        where: { organizationId },
        select: { couponsEnabled: true, couponMaxDiscountBps: true },
      }),
    ]);
    if (!policy?.couponsEnabled) {
      throw new ForbiddenException({
        code: "COMMERCE_TENANT_COUPONS_DISABLED",
        message: "Organization coupons are not enabled by the platform.",
      });
    }
    return Math.min(
      platform.tenantCouponMaxDiscountBps,
      policy.couponMaxDiscountBps ?? platform.tenantCouponMaxDiscountBps,
    );
  }

  private assertWithinBounds(value: number, min: number, max: number | null) {
    if (value <= 0 || value < min || (max !== null && value > max)) {
      throw new BadRequestException({
        code: "COMMERCE_PRICE_OUT_OF_BOUNDS",
        message: `Price must be greater than zero and within the platform bounds (${min}${
          max !== null ? `–${max}` : "+"
        }).`,
      });
    }
  }

  private assertCentral(context: AuthContext) {
    if (
      context.role !== MembershipRole.SUPER_ADMIN &&
      context.role !== MembershipRole.PLATFORM_ADMIN
    ) {
      this.denied();
    }
  }

  private assertOrganizationScope(context: AuthContext, organizationId: string) {
    if (context.organizationId !== null && context.organizationId !== organizationId) {
      throw new ForbiddenException({
        code: "COMMERCE_SCOPE_VIOLATION",
        message: "You cannot manage another organisation's commerce policy.",
      });
    }
  }

  private denied(): never {
    throw new ForbiddenException({
      code: "COMMERCE_PRICING_DENIED",
      message: "You are not permitted to change this pricing.",
    });
  }

  private defined<T extends object>(input: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }

  private policySnapshot(policy: {
    tenantCouponMaxDiscountBps: number;
    defaultTaxRateBps: number;
    taxInclusivePricing: boolean;
    counsellorFeePricingEnabled: boolean;
    counsellorFeeMinMinor: number;
    counsellorFeeMaxMinor: number | null;
  }) {
    return {
      tenantCouponMaxDiscountBps: policy.tenantCouponMaxDiscountBps,
      defaultTaxRateBps: policy.defaultTaxRateBps,
      taxInclusivePricing: policy.taxInclusivePricing,
      counsellorFeePricingEnabled: policy.counsellorFeePricingEnabled,
      counsellorFeeMinMinor: policy.counsellorFeeMinMinor,
      counsellorFeeMaxMinor: policy.counsellorFeeMaxMinor,
    };
  }

  private organizationPolicySnapshot(policy: {
    delegatedPricingEnabled: boolean;
    couponsEnabled: boolean;
    couponMaxDiscountBps: number | null;
    manualPaymentEnabled: boolean;
  }) {
    return {
      delegatedPricingEnabled: policy.delegatedPricingEnabled,
      couponsEnabled: policy.couponsEnabled,
      couponMaxDiscountBps: policy.couponMaxDiscountBps,
      manualPaymentEnabled: policy.manualPaymentEnabled,
    };
  }
}
