import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  CommerceOrderStatus,
  CommercePaymentStatus,
  CommerceWebhookEventStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { OrderFulfilmentService } from "./order-fulfilment.service";

const PROVIDER = "RAZORPAY";
const HANDLED_EVENTS = new Set(["payment.captured", "order.paid", "payment.failed"]);

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error_code?: string | null;
  error_description?: string | null;
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: { payment?: { entity?: RazorpayPaymentEntity } };
}

export type RazorpayWebhookOutcome =
  | { status: "processed"; orderId: string }
  | { status: "duplicate" | "ignored" | "unmatched" | "failed"; reason: string };

// Server-side fulfilment path for gateway payments. It never trusts the browser:
// the raw body is authenticated with the webhook secret, every event is journaled
// once by provider event id, and fulfilment runs through the same idempotent
// service as the client verify path, so whichever arrives first wins and the
// other becomes a no-op.
@Injectable()
export class RazorpayWebhookService {
  public constructor(
    @Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient,
    @Inject(OrderFulfilmentService) private readonly fulfilment: OrderFulfilmentService,
  ) {}

  public verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException({
        code: "PAYMENT_WEBHOOK_NOT_CONFIGURED",
        message: "Payment webhook verification is not configured.",
      });
    }
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, "hex");
    } catch {
      return false;
    }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  public async handle(
    rawBody: Buffer,
    signature: string | undefined,
    eventId: string | undefined,
  ): Promise<RazorpayWebhookOutcome> {
    const signatureValid = this.verifySignature(rawBody, signature);
    let body: RazorpayWebhookBody = {};
    try {
      body = JSON.parse(rawBody.toString("utf8")) as RazorpayWebhookBody;
    } catch {
      body = {};
    }
    const entity = body.payload?.payment?.entity ?? {};
    const eventType = body.event ?? "unknown";
    const journalId = eventId?.trim() || `${eventType}:${entity.id ?? "unknown"}`;

    let event;
    try {
      event = await this.prisma.commerceWebhookEvent.create({
        data: {
          provider: PROVIDER,
          eventId: journalId,
          eventType,
          signatureValid,
          payload: (body as Prisma.InputJsonValue) ?? {},
          status: signatureValid
            ? CommerceWebhookEventStatus.RECEIVED
            : CommerceWebhookEventStatus.FAILED,
          errorMessage: signatureValid ? null : "Invalid webhook signature.",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "duplicate", reason: "Event already journaled." };
      }
      throw error;
    }

    if (!signatureValid) return { status: "failed", reason: "Invalid webhook signature." };
    const providerOrderId = entity.order_id;
    if (!HANDLED_EVENTS.has(eventType) || !providerOrderId) {
      await this.finish(event.id, CommerceWebhookEventStatus.IGNORED, null);
      return { status: "ignored", reason: `Unhandled event ${eventType}.` };
    }

    try {
      const outcome = await this.prisma.$transaction(
        async (tx) => {
          const payment = await tx.commercePayment.findFirst({
            where: { provider: PROVIDER, providerOrderId },
            include: {
              order: {
                select: {
                  id: true,
                  organizationId: true,
                  status: true,
                  totalMinor: true,
                  currency: true,
                },
              },
            },
          });
          if (!payment) return { status: "unmatched" as const, reason: "No payment intent." };

          if (eventType === "payment.failed") {
            if (payment.status === CommercePaymentStatus.PENDING) {
              await tx.commercePayment.update({
                where: { id: payment.id },
                data: {
                  status: CommercePaymentStatus.FAILED,
                  failureCode: entity.error_code?.slice(0, 120) ?? "PAYMENT_FAILED",
                  failureMessage: entity.error_description?.slice(0, 500) ?? null,
                  webhookEventId: event.id,
                },
              });
            }
            return { status: "processed" as const, orderId: payment.order.id };
          }

          if (payment.order.status === CommerceOrderStatus.PAID) {
            // Client verify already completed this order; fulfilment stays idempotent.
            await this.fulfilment.fulfil(tx, payment.order.id, {
              actorUserId: null,
              origin: "GATEWAY_WEBHOOK",
              source: PROVIDER,
            });
            return { status: "processed" as const, orderId: payment.order.id };
          }
          if (payment.order.status !== CommerceOrderStatus.PENDING) {
            return { status: "ignored" as const, reason: "Order is not payable." };
          }
          if (
            typeof entity.amount === "number" &&
            (entity.amount !== payment.order.totalMinor ||
              (entity.currency ?? payment.order.currency) !== payment.order.currency)
          ) {
            throw new Error("Captured amount does not match the order total.");
          }

          const now = new Date();
          await tx.commercePayment.update({
            where: { id: payment.id },
            data: {
              status: CommercePaymentStatus.SUCCEEDED,
              providerPaymentId: entity.id ?? payment.providerPaymentId,
              completedAt: now,
              webhookEventId: event.id,
            },
          });
          await tx.commerceOrder.update({
            where: { id: payment.order.id },
            data: { status: CommerceOrderStatus.PAID, paidAt: now },
          });
          await this.fulfilment.fulfil(tx, payment.order.id, {
            actorUserId: null,
            origin: "GATEWAY_WEBHOOK",
            source: PROVIDER,
          });
          await tx.auditLog.create({
            data: {
              organizationId: payment.order.organizationId,
              actorUserId: null,
              action: "commerce.payment.succeeded",
              entityType: "CommerceOrder",
              entityId: payment.order.id,
              metadata: {
                provider: PROVIDER,
                origin: "GATEWAY_WEBHOOK",
                providerOrderId,
                providerPaymentId: entity.id ?? null,
                webhookEventId: event.id,
              },
            },
          });
          return { status: "processed" as const, orderId: payment.order.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.finish(
        event.id,
        outcome.status === "processed"
          ? CommerceWebhookEventStatus.PROCESSED
          : CommerceWebhookEventStatus.IGNORED,
        outcome.status === "processed" ? null : outcome.reason,
      );
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed.";
      await this.finish(event.id, CommerceWebhookEventStatus.FAILED, message.slice(0, 500));
      return { status: "failed", reason: message };
    }
  }

  private finish(id: string, status: CommerceWebhookEventStatus, errorMessage: string | null) {
    return this.prisma.commerceWebhookEvent.update({
      where: { id },
      data: { status, errorMessage, processedAt: new Date() },
    });
  }
}
