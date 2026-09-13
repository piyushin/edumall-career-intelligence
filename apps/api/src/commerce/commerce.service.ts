import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  CommerceCouponDiscountType,
  CommerceCouponStatus,
  CommerceEntitlementStatus,
  CommerceEntitlementType,
  CommerceOrderFulfilmentStatus,
  CommerceOrderPurchaserType,
  CommerceOrderStatus,
  CommercePaymentMethod,
  CommercePaymentStatus,
  CommerceProductAudience,
  CommerceProductKind,
  CommerceProductStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthContext } from "../auth/auth.types";
import { isPlatformAdministrator } from "../auth/authorization-context";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  AdminOrderQueryDto,
  CreateCandidateOrderDto,
  CreateCommerceCouponDto,
  CreateCommerceProductDto,
  ManualApproveOrderDto,
  OrderReferenceDto,
  UpdateCommerceProductDto,
  VerifyRazorpayPaymentDto,
} from "./commerce.types";
import { OrderFulfilmentService } from "./order-fulfilment.service";

const CANDIDATE_PRODUCT_KINDS: CommerceProductKind[] = [
  CommerceProductKind.REPORT,
  CommerceProductKind.COUNSELLING,
  CommerceProductKind.REPORT_AND_COUNSELLING,
];
const DEFAULT_TENANT_COUPON_MAX_BPS = 5000;

@Injectable()
export class CommerceService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
    @Inject(OrderFulfilmentService)
    private readonly fulfilment: OrderFulfilmentService,
  ) {}

  public async getCandidateCheckout(context: AuthContext, attemptId: string) {
    const attempt = await this.findCandidateAttempt(context, attemptId);
    const organizationId = attempt.assignment.organizationId;
    const assessmentVersionId = attempt.assignment.assessmentVersionId;

    const [products, entitlements] = await Promise.all([
      this.prisma.commerceProduct.findMany({
        where: {
          status: CommerceProductStatus.ACTIVE,
          audience: CommerceProductAudience.CANDIDATE,
          kind: { in: CANDIDATE_PRODUCT_KINDS },
          AND: [
            {
              OR: [{ organizationId: null }, { organizationId }],
            },
            {
              OR: [{ assessmentVersionId: null }, { assessmentVersionId }],
            },
          ],
        },
        orderBy: [{ priceMinor: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          kind: true,
          currency: true,
          priceMinor: true,
        },
      }),
      this.prisma.commerceEntitlement.findMany({
        where: {
          organizationId,
          userId: context.userId,
          attemptId,
          status: CommerceEntitlementStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          type: true,
          grantedAt: true,
          expiresAt: true,
          source: true,
        },
      }),
    ]);

    const publicSignup = this.isPublicSignup(attempt.assignment.metadata);
    const reportEntitlement = entitlements.some(
      (entitlement) => entitlement.type === CommerceEntitlementType.REPORT,
    );
    const counsellingEntitlement = entitlements.some(
      (entitlement) => entitlement.type === CommerceEntitlementType.COUNSELLING,
    );

    const scoringRun = attempt.scoringRuns[0] ?? null;
    const snapshot =
      attempt.reportGeneration?.reportDataSnapshot ?? scoringRun?.reportDataSnapshots[0] ?? null;
    const release = attempt.reportReleases[0] ?? null;
    const reportAccess = !publicSignup || reportEntitlement;

    const reportStatus =
      attempt.status !== AssessmentAttemptStatus.SUBMITTED
        ? "ASSESSMENT_IN_PROGRESS"
        : !scoringRun
          ? "SCORING"
          : attempt.reportGeneration?.status === "BLOCKED_CONFIGURATION"
            ? "REPORT_CONFIGURATION_BLOCKED"
            : attempt.reportGeneration?.status === "FAILED"
              ? "REPORT_GENERATION_FAILED"
              : snapshot
                ? reportAccess
                  ? "DETAILED_REPORT_UNLOCKED"
                  : "DETAILED_REPORT_READY_LOCKED"
                : "REPORT_PROCESSING";

    return {
      attemptId,
      assessmentTitle: attempt.assignment.assessmentVersion.title,
      submittedAt: attempt.submittedAt,
      reportStatus,
      reportReleased: Boolean(release),
      reportReleasedAt: release?.releasedAt ?? null,
      commerceRequired: publicSignup,
      reportAccess,
      counsellingAccess: counsellingEntitlement,
      candidate: attempt.assignment.user,
      products,
      entitlements,
    };
  }

  public async createCandidateOrder(
    context: AuthContext,
    attemptId: string,
    input: CreateCandidateOrderDto,
  ) {
    const attempt = await this.findCandidateAttempt(context, attemptId);

    if (attempt.status !== AssessmentAttemptStatus.SUBMITTED) {
      throw new ConflictException({
        code: "ASSESSMENT_NOT_SUBMITTED",
        message: "Complete and submit the assessment before purchasing report access.",
      });
    }

    const organizationId = attempt.assignment.organizationId;
    const assessmentVersionId = attempt.assignment.assessmentVersionId;
    const productCode = input.productCode.trim().toUpperCase();

    const product = await this.prisma.commerceProduct.findFirst({
      where: {
        code: productCode,
        status: CommerceProductStatus.ACTIVE,
        audience: CommerceProductAudience.CANDIDATE,
        kind: { in: CANDIDATE_PRODUCT_KINDS },
        AND: [
          {
            OR: [{ organizationId: null }, { organizationId }],
          },
          {
            OR: [{ assessmentVersionId: null }, { assessmentVersionId }],
          },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        currency: true,
        priceMinor: true,
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: "COMMERCE_PRODUCT_NOT_FOUND",
        message: "The selected report or counselling package is not available.",
      });
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const couponResult = input.couponCode
            ? await this.validateCoupon(
                tx,
                input.couponCode,
                product,
                organizationId,
                context.userId,
                product.priceMinor,
              )
            : null;

          const discountMinor = couponResult?.discountMinor ?? 0;
          const totalMinor = Math.max(0, product.priceMinor - discountMinor);
          const paidImmediately = totalMinor === 0;
          const now = new Date();

          const order = await tx.commerceOrder.create({
            data: {
              organizationId,
              userId: context.userId,
              attemptId,
              productId: product.id,
              couponId: couponResult?.coupon.id ?? null,
              purchaserType: CommerceOrderPurchaserType.CANDIDATE,
              quantity: 1,
              status: paidImmediately ? CommerceOrderStatus.PAID : CommerceOrderStatus.PENDING,
              currency: product.currency,
              subtotalMinor: product.priceMinor,
              discountMinor,
              totalMinor,
              couponCodeSnapshot: couponResult?.coupon.code ?? null,
              paidAt: paidImmediately ? now : null,
              metadata: {
                assessmentVersionId,
                productCode: product.code,
              },
            },
            select: {
              id: true,
              status: true,
              currency: true,
              subtotalMinor: true,
              discountMinor: true,
              totalMinor: true,
              paidAt: true,
            },
          });

          if (couponResult) {
            await tx.commerceCouponRedemption.create({
              data: {
                couponId: couponResult.coupon.id,
                userId: context.userId,
                orderId: order.id,
                discountMinor,
                metadata: {
                  couponCode: couponResult.coupon.code,
                },
              },
            });
          }

          if (paidImmediately) {
            await tx.commercePayment.create({
              data: {
                orderId: order.id,
                provider: couponResult ? "COUPON" : "SYSTEM",
                method: couponResult
                  ? CommercePaymentMethod.COUPON
                  : CommercePaymentMethod.COMPLIMENTARY,
                status: CommercePaymentStatus.SUCCEEDED,
                amountMinor: 0,
                currency: product.currency,
                completedAt: now,
                metadata: {
                  fullyDiscounted: Boolean(couponResult),
                },
              },
            });

            await this.fulfilment.fulfil(tx, order.id, {
              actorUserId: context.userId,
              origin: "CHECKOUT",
              source: couponResult ? "COUPON" : "COMPLIMENTARY",
            });
          }

          await tx.auditLog.create({
            data: {
              organizationId,
              actorUserId: context.userId,
              action: paidImmediately ? "commerce.order.completed" : "commerce.order.created",
              entityType: "CommerceOrder",
              entityId: order.id,
              metadata: {
                attemptId,
                productCode: product.code,
                subtotalMinor: product.priceMinor,
                discountMinor,
                totalMinor,
                couponCode: couponResult?.coupon.code ?? null,
              },
            },
          });

          return {
            ...order,
            product: {
              code: product.code,
              name: product.name,
              kind: product.kind,
            },
            paymentRequired: !paidImmediately,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException({
          code: "COMMERCE_CONCURRENT_UPDATE",
          message: "The order changed concurrently. Please try again.",
        });
      }

      throw error;
    }
  }

  public async createRazorpayPaymentIntent(context: AuthContext, orderId: string) {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!keyId || !keySecret) {
      return {
        gatewayConfigured: false as const,
        provider: "RAZORPAY",
        message:
          "Online payment gateway credentials are not configured yet. The order is saved and may be paid through coupon or approved payment.",
      };
    }

    const order = await this.findCandidateOrder(context, orderId);

    if (order.status === CommerceOrderStatus.PAID) {
      throw new ConflictException({
        code: "ORDER_ALREADY_PAID",
        message: "This order is already paid.",
      });
    }

    if (order.status !== CommerceOrderStatus.PENDING) {
      throw new ConflictException({
        code: "ORDER_NOT_PAYABLE",
        message: "This order cannot be paid.",
      });
    }

    if (order.totalMinor <= 0) {
      throw new ConflictException({
        code: "ORDER_PAYMENT_NOT_REQUIRED",
        message: "No payment is required for this order.",
      });
    }

    if (order.currency !== "INR") {
      throw new BadRequestException({
        code: "PAYMENT_CURRENCY_UNSUPPORTED",
        message: "Online payment currently supports INR orders.",
      });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    let response: Response;

    try {
      response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: order.totalMinor,
          currency: order.currency,
          receipt: `edumall_${order.id.replaceAll("-", "").slice(0, 24)}`,
          notes: {
            edumallOrderId: order.id,
            attemptId: order.attemptId,
          },
        }),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: "PAYMENT_GATEWAY_UNAVAILABLE",
        message: "The payment gateway could not be reached.",
      });
    }

    let gatewayBody: { id?: string; error?: { description?: string } };

    try {
      gatewayBody = (await response.json()) as {
        id?: string;
        error?: { description?: string };
      };
    } catch {
      gatewayBody = {};
    }

    if (!response.ok || !gatewayBody.id) {
      throw new ServiceUnavailableException({
        code: "PAYMENT_GATEWAY_ORDER_FAILED",
        message:
          gatewayBody.error?.description ??
          "The payment gateway could not create the payment order.",
      });
    }

    const payment = await this.prisma.commercePayment.create({
      data: {
        orderId: order.id,
        provider: "RAZORPAY",
        providerOrderId: gatewayBody.id,
        method: CommercePaymentMethod.ONLINE_GATEWAY,
        status: CommercePaymentStatus.PENDING,
        amountMinor: order.totalMinor,
        currency: order.currency,
      },
      select: {
        id: true,
      },
    });

    return {
      gatewayConfigured: true as const,
      provider: "RAZORPAY",
      keyId,
      paymentId: payment.id,
      orderId: order.id,
      gatewayOrderId: gatewayBody.id,
      amountMinor: order.totalMinor,
      currency: order.currency,
      description: order.product.name,
    };
  }

  public async verifyRazorpayPayment(context: AuthContext, input: VerifyRazorpayPaymentDto) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!keySecret) {
      throw new ServiceUnavailableException({
        code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
        message: "Payment verification is not configured.",
      });
    }

    const order = await this.findCandidateOrder(context, input.orderId);

    if (order.status === CommerceOrderStatus.PAID) {
      return {
        status: "paid" as const,
        orderId: order.id,
      };
    }

    const payment = await this.prisma.commercePayment.findFirst({
      where: {
        orderId: order.id,
        provider: "RAZORPAY",
        providerOrderId: input.razorpayOrderId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!payment) {
      throw new NotFoundException({
        code: "PAYMENT_INTENT_NOT_FOUND",
        message: "Payment intent not found.",
      });
    }

    const expected = createHmac("sha256", keySecret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest();

    let supplied: Buffer;

    try {
      supplied = Buffer.from(input.razorpaySignature, "hex");
    } catch {
      throw this.invalidPaymentSignature();
    }

    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw this.invalidPaymentSignature();
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.commercePayment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: input.razorpayPaymentId,
          status: CommercePaymentStatus.SUCCEEDED,
          completedAt: now,
        },
      });

      await tx.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: CommerceOrderStatus.PAID,
          paidAt: now,
        },
      });

      await this.fulfilment.fulfil(tx, order.id, {
        actorUserId: context.userId,
        origin: "GATEWAY_VERIFY",
        source: "RAZORPAY",
      });

      await tx.auditLog.create({
        data: {
          organizationId: order.organizationId,
          actorUserId: context.userId,
          action: "commerce.payment.succeeded",
          entityType: "CommerceOrder",
          entityId: order.id,
          metadata: {
            provider: "RAZORPAY",
            providerOrderId: input.razorpayOrderId,
            providerPaymentId: input.razorpayPaymentId,
          },
        },
      });
    });

    return {
      status: "paid" as const,
      orderId: order.id,
    };
  }

  public async createProduct(context: AuthContext, input: CreateCommerceProductDto) {
    const organizationId = this.resolveAdminOrganization(context, input.organizationId);

    if (input.assessmentVersionId) {
      const exists = await this.prisma.assessmentVersion.findUnique({
        where: { id: input.assessmentVersionId },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundException({
          code: "ASSESSMENT_VERSION_NOT_FOUND",
          message: "Assessment version not found.",
        });
      }
    }

    const code = input.code.trim().toUpperCase();
    const audience = this.resolveAudience(input.kind, input.audience);
    const unitQuantity = input.unitQuantity ?? 1;

    const product = await this.prisma.commerceProduct.create({
      data: {
        organizationId,
        assessmentVersionId: input.assessmentVersionId ?? null,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        kind: input.kind,
        audience,
        unitQuantity,
        currency: (input.currency ?? "INR").trim().toUpperCase(),
        priceMinor: input.priceMinor,
        createdByUserId: context.userId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId: context.userId,
        action: "commerce.product.created",
        entityType: "CommerceProduct",
        entityId: product.id,
        metadata: {
          code,
          kind: product.kind,
          audience,
          unitQuantity,
          priceMinor: product.priceMinor,
          currency: product.currency,
        },
      },
    });
    return product;
  }

  public async updateProduct(
    context: AuthContext,
    productId: string,
    input: UpdateCommerceProductDto,
  ) {
    const product = await this.prisma.commerceProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        organizationId: true,
        kind: true,
        audience: true,
        unitQuantity: true,
        priceMinor: true,
        status: true,
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: "COMMERCE_PRODUCT_NOT_FOUND",
        message: "Commerce product not found.",
      });
    }

    this.assertAdminScope(context, product.organizationId);
    const audience =
      input.audience !== undefined ? this.resolveAudience(product.kind, input.audience) : undefined;

    const updated = await this.prisma.commerceProduct.update({
      where: { id: productId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
        ...(input.priceMinor !== undefined ? { priceMinor: input.priceMinor } : {}),
        ...(input.unitQuantity !== undefined ? { unitQuantity: input.unitQuantity } : {}),
        ...(audience !== undefined ? { audience } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: product.organizationId,
        actorUserId: context.userId,
        action: "commerce.product.updated",
        entityType: "CommerceProduct",
        entityId: product.id,
        metadata: {
          before: {
            priceMinor: product.priceMinor,
            unitQuantity: product.unitQuantity,
            audience: product.audience,
            status: product.status,
          },
          after: {
            priceMinor: updated.priceMinor,
            unitQuantity: updated.unitQuantity,
            audience: updated.audience,
            status: updated.status,
          },
        },
      },
    });
    return updated;
  }

  public async listProducts(context: AuthContext) {
    const organizationId = this.adminOrganizationFilter(context);

    return this.prisma.commerceProduct.findMany({
      ...(organizationId === null
        ? {}
        : {
            where: {
              OR: [{ organizationId }, { organizationId: null }],
            },
          }),
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  }

  public async createCoupon(context: AuthContext, input: CreateCommerceCouponDto) {
    const organizationId = this.resolveAdminOrganization(context, input.organizationId);
    const central = this.isCentralAdministrator(context);

    let productId: string | null = null;
    let productPriceMinor: number | null = null;

    if (input.productCode) {
      const product = await this.prisma.commerceProduct.findUnique({
        where: {
          code: input.productCode.trim().toUpperCase(),
        },
        select: {
          id: true,
          organizationId: true,
          priceMinor: true,
          kind: true,
        },
      });

      if (!product) {
        throw new NotFoundException({
          code: "COMMERCE_PRODUCT_NOT_FOUND",
          message: "Coupon product not found.",
        });
      }

      if (organizationId && product.organizationId && product.organizationId !== organizationId) {
        throw new ForbiddenException({
          code: "COMMERCE_SCOPE_VIOLATION",
          message: "Coupon and product belong to different organisations.",
        });
      }

      if (input.appliesToKind && product.kind !== input.appliesToKind) {
        throw new BadRequestException({
          code: "COUPON_KIND_MISMATCH",
          message: "appliesToKind must match the bound product's kind.",
        });
      }

      productId = product.id;
      productPriceMinor = product.priceMinor;
    }

    // Tenant administrators may only discount within the platform cap and only on
    // a specific product, so a coupon can never create free platform value.
    if (!central) {
      const capBps = this.tenantCouponMaxBps();
      if (input.discountType === CommerceCouponDiscountType.FREE) {
        throw new ForbiddenException({
          code: "COUPON_FREE_CENTRAL_ONLY",
          message: "Free coupons can only be created by central platform administrators.",
        });
      }
      if (productId === null || productPriceMinor === null) {
        throw new ForbiddenException({
          code: "COUPON_PRODUCT_REQUIRED",
          message: "Organisation coupons must be bound to a specific product.",
        });
      }
      if (
        input.discountType === CommerceCouponDiscountType.PERCENTAGE &&
        (input.percentageBps ?? 0) > capBps
      ) {
        throw new ForbiddenException({
          code: "COUPON_DISCOUNT_EXCEEDS_CAP",
          message: `Organisation coupons may discount at most ${capBps / 100}%.`,
        });
      }
      if (
        input.discountType === CommerceCouponDiscountType.FIXED &&
        (input.fixedAmountMinor ?? 0) > Math.floor((productPriceMinor * capBps) / 10000)
      ) {
        throw new ForbiddenException({
          code: "COUPON_DISCOUNT_EXCEEDS_CAP",
          message: `Organisation coupons may discount at most ${capBps / 100}% of the product price.`,
        });
      }
    }

    if (input.discountType === CommerceCouponDiscountType.PERCENTAGE && !input.percentageBps) {
      throw new BadRequestException({
        code: "COUPON_PERCENTAGE_REQUIRED",
        message: "percentageBps is required for percentage coupons.",
      });
    }

    if (input.discountType === CommerceCouponDiscountType.FIXED && !input.fixedAmountMinor) {
      throw new BadRequestException({
        code: "COUPON_FIXED_AMOUNT_REQUIRED",
        message: "fixedAmountMinor is required for fixed coupons.",
      });
    }

    const validFrom = input.validFrom ? new Date(input.validFrom) : new Date();
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;

    if (validUntil && validUntil <= validFrom) {
      throw new BadRequestException({
        code: "COUPON_VALIDITY_INVALID",
        message: "Coupon expiry must be after its start time.",
      });
    }

    return this.prisma.commerceCoupon.create({
      data: {
        organizationId,
        productId,
        code: input.code.trim().toUpperCase(),
        description: input.description?.trim() || null,
        discountType: input.discountType,
        appliesToKind: input.appliesToKind ?? null,
        percentageBps: input.percentageBps ?? null,
        fixedAmountMinor: input.fixedAmountMinor ?? null,
        validFrom,
        validUntil,
        maxRedemptions: input.maxRedemptions ?? null,
        perUserLimit: input.perUserLimit ?? 1,
        status: input.status ?? CommerceCouponStatus.ACTIVE,
        createdByUserId: context.userId,
      },
    });
  }

  public async listCoupons(context: AuthContext) {
    const organizationId = this.adminOrganizationFilter(context);

    return this.prisma.commerceCoupon.findMany({
      ...(organizationId === null
        ? {}
        : {
            where: {
              OR: [{ organizationId }, { organizationId: null }],
            },
          }),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });
  }

  public async listOrders(context: AuthContext, query: AdminOrderQueryDto) {
    const scopedOrganizationId = this.adminOrganizationFilter(context);
    if (
      scopedOrganizationId !== null &&
      query.organizationId &&
      query.organizationId !== scopedOrganizationId
    ) {
      throw new ForbiddenException({
        code: "COMMERCE_SCOPE_VIOLATION",
        message: "You cannot view another organisation's orders.",
      });
    }
    const organizationId = scopedOrganizationId ?? query.organizationId;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = new Date(query.to);
    const q = query.q?.trim();

    const where: Prisma.CommerceOrderWhereInput = {
      ...(organizationId ? { organizationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.fulfilmentStatus ? { fulfilmentStatus: query.fulfilmentStatus } : {}),
      ...(query.purchaserType ? { purchaserType: query.purchaserType } : {}),
      ...(query.productKind ? { product: { kind: query.productKind } } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              ...(/^[0-9a-f-]{36}$/i.test(q) ? [{ id: q }, { attemptId: q }] : []),
              { user: { email: { contains: q, mode: "insensitive" as const } } },
              { user: { firstName: { contains: q, mode: "insensitive" as const } } },
              { user: { lastName: { contains: q, mode: "insensitive" as const } } },
              { user: { phoneE164: { contains: q.replace(/[\s().-]/g, "") } } },
              { organization: { name: { contains: q, mode: "insensitive" as const } } },
              { product: { code: { contains: q.toUpperCase() } } },
              { couponCodeSnapshot: { contains: q.toUpperCase() } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.commerceOrder.count({ where }),
      this.prisma.commerceOrder.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.orderInclude(),
      }),
    ]);
    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  public async getOrder(context: AuthContext, orderId: string) {
    const order = await this.prisma.commerceOrder.findUnique({
      where: { id: orderId },
      include: {
        ...this.orderInclude(),
        entitlements: {
          select: {
            id: true,
            type: true,
            status: true,
            source: true,
            grantedAt: true,
            revokedAt: true,
            expiresAt: true,
          },
        },
        creditLedgerEntries: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            walletId: true,
            eventType: true,
            quantity: true,
            delta: true,
            balanceAfter: true,
            createdAt: true,
          },
        },
        couponRedemptions: { select: { id: true, discountMinor: true, redeemedAt: true } },
      },
    });
    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    this.assertAdminScope(context, order.organizationId);
    return order;
  }

  public async cancelOrder(context: AuthContext, orderId: string, input: OrderReferenceDto) {
    this.assertCentralAdministrator(context);
    const order = await this.prisma.commerceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    this.assertAdminScope(context, order.organizationId);
    if (order.status !== CommerceOrderStatus.PENDING) {
      throw new ConflictException({
        code: "ORDER_NOT_CANCELLABLE",
        message: "Only pending orders can be cancelled.",
      });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.commercePayment.updateMany({
        where: { orderId: order.id, status: CommercePaymentStatus.PENDING },
        data: {
          status: CommercePaymentStatus.FAILED,
          failureCode: "ORDER_CANCELLED",
          failureMessage: input.reason?.trim() || "Order cancelled by administrator.",
        },
      });
      await tx.commerceOrder.update({
        where: { id: order.id },
        data: { status: CommerceOrderStatus.CANCELLED, cancelledAt: now },
      });
      await tx.auditLog.create({
        data: {
          organizationId: order.organizationId,
          actorUserId: context.userId,
          action: "commerce.order.cancelled",
          entityType: "CommerceOrder",
          entityId: order.id,
          metadata: { reason: input.reason ?? null, reference: input.reference ?? null },
        },
      });
    });
    return { status: "cancelled" as const, orderId: order.id };
  }

  // Records the refund and reverses value the platform still holds. Moving money
  // back through the gateway is an operator action in the provider console; a
  // later refund webhook for the same order is then a no-op here.
  public async refundOrder(context: AuthContext, orderId: string, input: OrderReferenceDto) {
    this.assertCentralAdministrator(context);
    const order = await this.prisma.commerceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, organizationId: true, status: true, totalMinor: true, currency: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    this.assertAdminScope(context, order.organizationId);
    if (order.status === CommerceOrderStatus.REFUNDED) {
      return { status: "refunded" as const, orderId: order.id };
    }
    if (order.status !== CommerceOrderStatus.PAID) {
      throw new ConflictException({
        code: "ORDER_NOT_REFUNDABLE",
        message: "Only paid orders can be refunded.",
      });
    }
    const now = new Date();
    const result = await this.prisma.$transaction(
      async (tx) => {
        const reversal = await this.fulfilment.reverse(
          tx,
          order.id,
          { actorUserId: context.userId, origin: "ADMIN_REFUND", source: "REFUND" },
          input.reference,
        );
        await tx.commercePayment.create({
          data: {
            orderId: order.id,
            provider: "MANUAL",
            method: CommercePaymentMethod.BANK_TRANSFER,
            status: CommercePaymentStatus.REFUNDED,
            amountMinor: order.totalMinor,
            currency: order.currency,
            reference: input.reference?.trim() || null,
            approvedByUserId: context.userId,
            completedAt: now,
            metadata: { reason: input.reason ?? null },
          },
        });
        await tx.commerceOrder.update({
          where: { id: order.id },
          data: { status: CommerceOrderStatus.REFUNDED, refundedAt: now },
        });
        await tx.auditLog.create({
          data: {
            organizationId: order.organizationId,
            actorUserId: context.userId,
            action: "commerce.order.refunded",
            entityType: "CommerceOrder",
            entityId: order.id,
            metadata: {
              reason: input.reason ?? null,
              reference: input.reference ?? null,
              revokedEntitlements: reversal.revokedEntitlements,
              reversedCredits: reversal.reversedCredits,
            },
          },
        });
        return reversal;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { ...result, status: "refunded" as const, orderId: order.id };
  }

  public async retryFulfilment(context: AuthContext, orderId: string) {
    this.assertCentralAdministrator(context);
    const order = await this.prisma.commerceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, organizationId: true, status: true, fulfilmentStatus: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    this.assertAdminScope(context, order.organizationId);
    if (order.status !== CommerceOrderStatus.PAID) {
      throw new ConflictException({
        code: "ORDER_NOT_PAID",
        message: "Only paid orders can be fulfilled.",
      });
    }
    if (order.fulfilmentStatus === CommerceOrderFulfilmentStatus.FULFILLED) {
      return { status: "fulfilled" as const, orderId: order.id, alreadyFulfilled: true };
    }
    await this.prisma.$transaction(
      (tx) =>
        this.fulfilment.fulfil(tx, order.id, {
          actorUserId: context.userId,
          origin: "ADMIN_RETRY",
          source: "ADMIN_RETRY",
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { status: "fulfilled" as const, orderId: order.id, alreadyFulfilled: false };
  }

  private orderInclude() {
    return {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true } },
      product: {
        select: { code: true, name: true, kind: true, audience: true, unitQuantity: true },
      },
      coupon: { select: { code: true } },
      payments: { orderBy: { createdAt: "desc" as const } },
    } satisfies Prisma.CommerceOrderInclude;
  }

  public async manualApproveOrder(
    context: AuthContext,
    orderId: string,
    input: ManualApproveOrderDto,
  ) {
    this.assertCentralAdministrator(context);
    if (
      input.method === CommercePaymentMethod.ONLINE_GATEWAY ||
      input.method === CommercePaymentMethod.COUPON
    ) {
      throw new BadRequestException({
        code: "MANUAL_PAYMENT_METHOD_INVALID",
        message:
          "Manual approval must use bank transfer, UPI, cash, sponsored or complimentary payment.",
      });
    }

    const order = await this.prisma.commerceOrder.findUnique({
      where: { id: orderId },
      include: {
        product: {
          select: {
            kind: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }

    this.assertAdminScope(context, order.organizationId);

    if (order.status === CommerceOrderStatus.PAID) {
      return {
        status: "paid" as const,
        orderId: order.id,
      };
    }

    if (order.status !== CommerceOrderStatus.PENDING) {
      throw new ConflictException({
        code: "ORDER_NOT_PAYABLE",
        message: "This order cannot be manually approved.",
      });
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.commercePayment.create({
        data: {
          orderId: order.id,
          provider: "MANUAL",
          method: input.method,
          status: CommercePaymentStatus.MANUAL_APPROVED,
          amountMinor: order.totalMinor,
          currency: order.currency,
          reference: input.reference?.trim() || null,
          approvedByUserId: context.userId,
          completedAt: now,
        },
      });

      await tx.commerceOrder.update({
        where: { id: order.id },
        data: {
          status: CommerceOrderStatus.PAID,
          paidAt: now,
        },
      });

      await this.fulfilment.fulfil(tx, order.id, {
        actorUserId: context.userId,
        origin: "MANUAL_APPROVAL",
        source: input.method,
      });

      await tx.auditLog.create({
        data: {
          organizationId: order.organizationId,
          actorUserId: context.userId,
          action: "commerce.payment.manual_approved",
          entityType: "CommerceOrder",
          entityId: order.id,
          metadata: {
            method: input.method,
            reference: input.reference ?? null,
          },
        },
      });
    });

    return {
      status: "paid" as const,
      orderId: order.id,
    };
  }

  private async validateCoupon(
    tx: Prisma.TransactionClient,
    rawCode: string,
    product: { id: string; kind: CommerceProductKind },
    organizationId: string,
    userId: string,
    subtotalMinor: number,
  ) {
    const productId = product.id;
    const code = rawCode.trim().toUpperCase();
    const coupon = await tx.commerceCoupon.findUnique({
      where: { code },
      select: {
        id: true,
        organizationId: true,
        productId: true,
        appliesToKind: true,
        code: true,
        discountType: true,
        percentageBps: true,
        fixedAmountMinor: true,
        validFrom: true,
        validUntil: true,
        maxRedemptions: true,
        perUserLimit: true,
        status: true,
      },
    });

    if (!coupon || coupon.status !== CommerceCouponStatus.ACTIVE) {
      throw new BadRequestException({
        code: "COUPON_INVALID",
        message: "Coupon code is invalid or inactive.",
      });
    }

    const now = new Date();

    if (coupon.validFrom > now || (coupon.validUntil !== null && coupon.validUntil <= now)) {
      throw new BadRequestException({
        code: "COUPON_EXPIRED",
        message: "Coupon code is not currently valid.",
      });
    }

    if (coupon.organizationId !== null && coupon.organizationId !== organizationId) {
      throw new BadRequestException({
        code: "COUPON_NOT_APPLICABLE",
        message: "Coupon code is not valid for this organisation.",
      });
    }

    if (
      (coupon.productId !== null && coupon.productId !== productId) ||
      (coupon.appliesToKind !== null && coupon.appliesToKind !== product.kind)
    ) {
      throw new BadRequestException({
        code: "COUPON_NOT_APPLICABLE",
        message: "Coupon code is not valid for this package.",
      });
    }

    // Coupon usage limits are consumed only by completed/paid orders.
    // Applying a coupon to a pending or abandoned checkout must not burn
    // organisation-wide or per-user redemption capacity.
    const [totalRedemptions, userRedemptions] = await Promise.all([
      tx.commerceCouponRedemption.count({
        where: {
          couponId: coupon.id,
          order: {
            status: CommerceOrderStatus.PAID,
          },
        },
      }),
      tx.commerceCouponRedemption.count({
        where: {
          couponId: coupon.id,
          userId,
          order: {
            status: CommerceOrderStatus.PAID,
          },
        },
      }),
    ]);

    if (coupon.maxRedemptions !== null && totalRedemptions >= coupon.maxRedemptions) {
      throw new BadRequestException({
        code: "COUPON_LIMIT_REACHED",
        message: "Coupon redemption limit has been reached.",
      });
    }

    if (userRedemptions >= coupon.perUserLimit) {
      throw new BadRequestException({
        code: "COUPON_USER_LIMIT_REACHED",
        message: "This coupon has already been used by this account.",
      });
    }

    let discountMinor = 0;

    if (coupon.discountType === CommerceCouponDiscountType.FREE) {
      discountMinor = subtotalMinor;
    } else if (coupon.discountType === CommerceCouponDiscountType.PERCENTAGE) {
      discountMinor = Math.floor((subtotalMinor * (coupon.percentageBps ?? 0)) / 10000);
    } else if (coupon.discountType === CommerceCouponDiscountType.FIXED) {
      discountMinor = Math.min(subtotalMinor, coupon.fixedAmountMinor ?? 0);
    }

    return {
      coupon,
      discountMinor: Math.max(0, Math.min(subtotalMinor, discountMinor)),
    };
  }

  private async findCandidateAttempt(context: AuthContext, attemptId: string) {
    const organizationId = this.requireOrganization(context);

    const attempt = await this.prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        assignment: {
          organizationId,
          userId: context.userId,
        },
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        assignment: {
          select: {
            organizationId: true,
            assessmentVersionId: true,
            metadata: true,
            assessmentVersion: {
              select: {
                title: true,
              },
            },
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        scoringRuns: {
          orderBy: {
            calculatedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            reportDataSnapshots: {
              orderBy: {
                generatedAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                generatedAt: true,
              },
            },
          },
        },
        reportGeneration: {
          select: {
            status: true,
            reportDataSnapshot: {
              select: { id: true, generatedAt: true },
            },
          },
        },
        reportReleases: {
          orderBy: {
            releasedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            releasedAt: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
        message: "Assessment attempt not found.",
      });
    }

    return attempt;
  }

  private async findCandidateOrder(context: AuthContext, orderId: string) {
    const organizationId = this.requireOrganization(context);

    const order = await this.prisma.commerceOrder.findFirst({
      where: {
        id: orderId,
        organizationId,
        userId: context.userId,
      },
      include: {
        product: {
          select: {
            name: true,
            kind: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }

    return order;
  }

  private isPublicSignup(metadata: Prisma.JsonValue | null): boolean {
    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
      return false;
    }

    return (metadata as Record<string, unknown>).registrationSource === "PUBLIC_SIGNUP";
  }

  private requireOrganization(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organisation-scoped session is required.",
      });
    }

    return context.organizationId;
  }

  private resolveAdminOrganization(
    context: AuthContext,
    requestedOrganizationId?: string,
  ): string | null {
    if (isPlatformAdministrator(context)) {
      return requestedOrganizationId ?? null;
    }

    const organizationId = this.requireOrganization(context);

    if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
      throw new ForbiddenException({
        code: "COMMERCE_SCOPE_VIOLATION",
        message: "You cannot manage another organisation's commerce data.",
      });
    }

    return organizationId;
  }

  private adminOrganizationFilter(context: AuthContext): string | null {
    if (isPlatformAdministrator(context)) {
      return null;
    }

    return this.requireOrganization(context);
  }

  private assertAdminScope(context: AuthContext, organizationId: string | null): void {
    if (isPlatformAdministrator(context)) {
      return;
    }

    const current = this.requireOrganization(context);

    if (organizationId !== current) {
      throw new ForbiddenException({
        code: "COMMERCE_SCOPE_VIOLATION",
        message: "You cannot manage another organisation's commerce data.",
      });
    }
  }

  private resolveAudience(
    kind: CommerceProductKind,
    requested?: CommerceProductAudience,
  ): CommerceProductAudience {
    if (kind === CommerceProductKind.REPORT_CREDIT_PACK) {
      if (!requested || requested === CommerceProductAudience.CANDIDATE) {
        throw new BadRequestException({
          code: "COMMERCE_PRODUCT_AUDIENCE_INVALID",
          message: "Report credit packs are sold to organisations or counsellors, not candidates.",
        });
      }
      return requested;
    }
    if (requested && requested !== CommerceProductAudience.CANDIDATE) {
      throw new BadRequestException({
        code: "COMMERCE_PRODUCT_AUDIENCE_INVALID",
        message: "Report and counselling packages are candidate products.",
      });
    }
    return CommerceProductAudience.CANDIDATE;
  }

  private isCentralAdministrator(context: AuthContext): boolean {
    return (
      context.role === MembershipRole.SUPER_ADMIN || context.role === MembershipRole.PLATFORM_ADMIN
    );
  }

  private assertCentralAdministrator(context: AuthContext): void {
    if (!this.isCentralAdministrator(context)) {
      throw new ForbiddenException({
        code: "COMMERCE_CENTRAL_ONLY",
        message: "This commerce operation is reserved for central platform administrators.",
      });
    }
  }

  private tenantCouponMaxBps(): number {
    const raw = Number.parseInt(process.env.COMMERCE_TENANT_COUPON_MAX_BPS ?? "", 10);
    return Number.isInteger(raw) && raw >= 0 && raw <= 10000 ? raw : DEFAULT_TENANT_COUPON_MAX_BPS;
  }

  private invalidPaymentSignature(): BadRequestException {
    return new BadRequestException({
      code: "PAYMENT_SIGNATURE_INVALID",
      message: "Payment verification failed.",
    });
  }
}
