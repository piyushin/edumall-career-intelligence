import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CommerceCreditLedgerEventType,
  CommerceCreditType,
  CommerceCreditWalletOwnerType,
  CommerceCreditWalletStatus,
  CommerceEntitlementStatus,
  CommerceEntitlementType,
  CommerceOrderFulfilmentStatus,
  CommerceOrderPurchaserType,
  CommerceOrderStatus,
  CommerceProductKind,
  Prisma,
} from "@prisma/client";

export interface FulfilmentActor {
  // Null when the trigger is a provider webhook; ledger rows then attribute the
  // purchaser as actor and record the origin in metadata.
  actorUserId: string | null;
  origin:
    | "CHECKOUT"
    | "GATEWAY_VERIFY"
    | "GATEWAY_WEBHOOK"
    | "MANUAL_APPROVAL"
    | "ADMIN_RETRY"
    | "ADMIN_REFUND";
  source: string;
}

type FulfilmentOrder = Prisma.CommerceOrderGetPayload<{
  include: { product: { select: { kind: true; unitQuantity: true; code: true } } };
}>;

// Single idempotent fulfilment path for every paid order regardless of how the
// payment arrived (zero-total checkout, gateway verify, gateway webhook, manual
// approval, or administrative retry). Callers must already have marked the
// order PAID inside the same transaction.
@Injectable()
export class OrderFulfilmentService {
  public async fulfil(tx: Prisma.TransactionClient, orderId: string, actor: FulfilmentActor) {
    const order = await tx.commerceOrder.findUnique({
      where: { id: orderId },
      include: { product: { select: { kind: true, unitQuantity: true, code: true } } },
    });
    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    if (order.fulfilmentStatus === CommerceOrderFulfilmentStatus.FULFILLED) {
      return { orderId: order.id, fulfilled: false as const, alreadyFulfilled: true as const };
    }
    if (order.status !== CommerceOrderStatus.PAID) {
      throw new ConflictException({
        code: "ORDER_NOT_PAID",
        message: "Only paid orders can be fulfilled.",
      });
    }

    const now = new Date();
    if (order.product.kind === CommerceProductKind.REPORT_CREDIT_PACK) {
      await this.creditPurchase(tx, order, actor, now);
    } else {
      await this.grantEntitlements(tx, {
        organizationId: order.organizationId,
        userId: order.userId,
        attemptId: this.requireAttempt(order),
        orderId: order.id,
        productKind: order.product.kind,
        source: actor.source,
      });
    }

    await tx.commerceOrder.update({
      where: { id: order.id },
      data: { fulfilmentStatus: CommerceOrderFulfilmentStatus.FULFILLED, fulfilledAt: now },
    });
    await tx.auditLog.create({
      data: {
        organizationId: order.organizationId,
        actorUserId: actor.actorUserId ?? order.userId,
        action: "commerce.order.fulfilled",
        entityType: "CommerceOrder",
        entityId: order.id,
        metadata: {
          origin: actor.origin,
          source: actor.source,
          productKind: order.product.kind,
          productCode: order.product.code,
          quantity: order.quantity,
          unitQuantity: order.product.unitQuantity,
        },
      },
    });
    return { orderId: order.id, fulfilled: true as const, alreadyFulfilled: false as const };
  }

  // Refund semantics: candidate entitlements from this order are revoked; for
  // credit packs only credits still unconsumed in the wallet are reversed. Credits
  // already spent on report grants are never clawed back from those grants.
  public async reverse(
    tx: Prisma.TransactionClient,
    orderId: string,
    actor: FulfilmentActor,
    reference?: string | null,
  ) {
    const order = await tx.commerceOrder.findUnique({
      where: { id: orderId },
      include: { product: { select: { kind: true, unitQuantity: true, code: true } } },
    });
    if (!order) {
      throw new NotFoundException({
        code: "COMMERCE_ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }
    if (order.fulfilmentStatus !== CommerceOrderFulfilmentStatus.FULFILLED) {
      return { orderId: order.id, revokedEntitlements: 0, reversedCredits: 0 };
    }

    let revokedEntitlements = 0;
    let reversedCredits = 0;
    const now = new Date();
    if (order.product.kind === CommerceProductKind.REPORT_CREDIT_PACK) {
      reversedCredits = await this.reverseUnconsumedCredits(tx, order, actor, now, reference);
    } else {
      const revoked = await tx.commerceEntitlement.updateMany({
        where: { orderId: order.id, status: CommerceEntitlementStatus.ACTIVE },
        data: { status: CommerceEntitlementStatus.REVOKED, revokedAt: now },
      });
      revokedEntitlements = revoked.count;
    }
    return { orderId: order.id, revokedEntitlements, reversedCredits };
  }

  private async creditPurchase(
    tx: Prisma.TransactionClient,
    order: FulfilmentOrder,
    actor: FulfilmentActor,
    now: Date,
  ) {
    const walletId = order.creditWalletId ?? (await this.walletForPurchaser(tx, order)).id;
    const credits = order.product.unitQuantity * order.quantity;
    const existing = await tx.commerceCreditLedgerEntry.findFirst({
      where: { orderId: order.id, eventType: CommerceCreditLedgerEventType.PURCHASE },
      select: { id: true },
    });
    if (existing) return;

    const status = await tx.commerceCreditWallet.findUniqueOrThrow({
      where: { id: walletId },
      select: { status: true },
    });
    if (status.status === CommerceCreditWalletStatus.CLOSED) {
      throw new ConflictException({
        code: "REPORT_CREDIT_WALLET_INACTIVE",
        message: "The purchaser's report-credit wallet is closed.",
      });
    }
    const wallet = await tx.commerceCreditWallet.update({
      where: { id: walletId },
      data: { currentBalance: { increment: credits } },
      select: { currentBalance: true },
    });
    await tx.commerceCreditLedgerEntry.create({
      data: {
        walletId,
        eventType: CommerceCreditLedgerEventType.PURCHASE,
        quantity: credits,
        delta: credits,
        balanceAfter: wallet.currentBalance,
        orderId: order.id,
        actorUserId: actor.actorUserId ?? order.userId,
        reference: order.product.code,
        metadata: { origin: actor.origin, source: actor.source, now: now.toISOString() },
      },
    });
  }

  private async reverseUnconsumedCredits(
    tx: Prisma.TransactionClient,
    order: FulfilmentOrder,
    actor: FulfilmentActor,
    now: Date,
    reference?: string | null,
  ): Promise<number> {
    const purchase = await tx.commerceCreditLedgerEntry.findFirst({
      where: { orderId: order.id, eventType: CommerceCreditLedgerEventType.PURCHASE },
      select: { walletId: true, quantity: true },
    });
    if (!purchase) return 0;
    const alreadyReversed = await tx.commerceCreditLedgerEntry.aggregate({
      where: { orderId: order.id, eventType: CommerceCreditLedgerEventType.REVERSAL },
      _sum: { quantity: true },
    });
    const wallet = await tx.commerceCreditWallet.findUniqueOrThrow({
      where: { id: purchase.walletId },
      select: { currentBalance: true },
    });
    const reversible = Math.min(
      wallet.currentBalance,
      purchase.quantity - (alreadyReversed._sum.quantity ?? 0),
    );
    if (reversible <= 0) return 0;

    const updated = await tx.commerceCreditWallet.update({
      where: { id: purchase.walletId },
      data: { currentBalance: { decrement: reversible } },
      select: { currentBalance: true },
    });
    await tx.commerceCreditLedgerEntry.create({
      data: {
        walletId: purchase.walletId,
        eventType: CommerceCreditLedgerEventType.REVERSAL,
        quantity: reversible,
        delta: -reversible,
        balanceAfter: updated.currentBalance,
        orderId: order.id,
        actorUserId: actor.actorUserId ?? order.userId,
        reference: reference?.trim() || null,
        metadata: { origin: actor.origin, reason: "ORDER_REFUND", now: now.toISOString() },
      },
    });
    return reversible;
  }

  private async walletForPurchaser(tx: Prisma.TransactionClient, order: FulfilmentOrder) {
    const where =
      order.purchaserType === CommerceOrderPurchaserType.ORGANIZATION
        ? {
            ownerType: CommerceCreditWalletOwnerType.ORGANIZATION,
            ownerOrganizationId: order.organizationId,
            ownerUserId: null,
          }
        : order.purchaserType === CommerceOrderPurchaserType.COUNSELLOR
          ? {
              ownerType: CommerceCreditWalletOwnerType.USER,
              ownerUserId: order.userId,
              ownerOrganizationId: null,
            }
          : null;
    if (!where) {
      throw new ConflictException({
        code: "ORDER_PURCHASER_INVALID",
        message: "Credit packs can only be fulfilled for organization or counsellor purchasers.",
      });
    }
    const existing = await tx.commerceCreditWallet.findFirst({
      where: { ...where, creditType: CommerceCreditType.REPORT_ACCESS },
    });
    if (existing) return existing;
    return tx.commerceCreditWallet.create({
      data: { ...where, creditType: CommerceCreditType.REPORT_ACCESS },
    });
  }

  private requireAttempt(order: FulfilmentOrder): string {
    if (!order.attemptId) {
      throw new ConflictException({
        code: "ORDER_ATTEMPT_REQUIRED",
        message: "Candidate report and counselling orders must reference an attempt.",
      });
    }
    return order.attemptId;
  }

  private async grantEntitlements(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      userId: string;
      attemptId: string;
      orderId: string;
      productKind: CommerceProductKind;
      source: string;
    },
  ) {
    const types: CommerceEntitlementType[] = [];
    if (
      input.productKind === CommerceProductKind.REPORT ||
      input.productKind === CommerceProductKind.REPORT_AND_COUNSELLING
    ) {
      types.push(CommerceEntitlementType.REPORT);
    }
    if (
      input.productKind === CommerceProductKind.COUNSELLING ||
      input.productKind === CommerceProductKind.REPORT_AND_COUNSELLING
    ) {
      types.push(CommerceEntitlementType.COUNSELLING);
    }
    for (const type of types) {
      await tx.commerceEntitlement.upsert({
        where: {
          userId_attemptId_type: { userId: input.userId, attemptId: input.attemptId, type },
        },
        create: {
          organizationId: input.organizationId,
          userId: input.userId,
          attemptId: input.attemptId,
          orderId: input.orderId,
          type,
          status: CommerceEntitlementStatus.ACTIVE,
          source: input.source,
        },
        update: {
          orderId: input.orderId,
          status: CommerceEntitlementStatus.ACTIVE,
          source: input.source,
          revokedAt: null,
        },
      });
    }
  }
}
