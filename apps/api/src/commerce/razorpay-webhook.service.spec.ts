import { Prisma, type PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderFulfilmentService } from "./order-fulfilment.service";
import { RazorpayWebhookService } from "./razorpay-webhook.service";

const SECRET = "whsec_test";
const orderId = "44444444-4444-4444-8444-444444444444";

function body(event: string, entity: Record<string, unknown>) {
  return Buffer.from(JSON.stringify({ event, payload: { payment: { entity } } }));
}
function sign(raw: Buffer) {
  return createHmac("sha256", SECRET).update(raw).digest("hex");
}

function harness(options: { orderStatus?: string; payment?: boolean; duplicate?: boolean } = {}) {
  const payment =
    options.payment === false
      ? null
      : {
          id: "payment",
          status: "PENDING",
          providerPaymentId: null,
          order: {
            id: orderId,
            organizationId: "org",
            status: options.orderStatus ?? "PENDING",
            totalMinor: 49900,
            currency: "INR",
          },
        };
  const tx = {
    commercePayment: {
      findFirst: vi.fn().mockResolvedValue(payment),
      update: vi.fn().mockResolvedValue({}),
    },
    commerceOrder: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    commerceWebhookEvent: {
      create: vi.fn().mockImplementation(() =>
        options.duplicate
          ? Promise.reject(
              new Prisma.PrismaClientKnownRequestError("dup", {
                code: "P2002",
                clientVersion: "test",
              }),
            )
          : Promise.resolve({ id: "event" }),
      ),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const fulfilment = { fulfil: vi.fn().mockResolvedValue({ fulfilled: true }) };
  return {
    prisma,
    tx,
    fulfilment,
    service: new RazorpayWebhookService(
      prisma as unknown as PrismaClient,
      fulfilment as unknown as OrderFulfilmentService,
    ),
  };
}

describe("RazorpayWebhookService", () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it("journals and rejects events with an invalid signature without touching orders", async () => {
    const { service, prisma, fulfilment } = harness();
    const raw = body("payment.captured", { id: "pay_1", order_id: "order_1", amount: 49900 });
    const outcome = await service.handle(raw, "00".repeat(32), "evt_1");
    expect(outcome.status).toBe("failed");
    expect(prisma.commerceWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ signatureValid: false, status: "FAILED" }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it("treats a replayed provider event id as a duplicate", async () => {
    const { service, prisma } = harness({ duplicate: true });
    const raw = body("payment.captured", { id: "pay_1", order_id: "order_1", amount: 49900 });
    const outcome = await service.handle(raw, sign(raw), "evt_1");
    expect(outcome.status).toBe("duplicate");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("marks the payment and order paid and fulfils on a captured payment", async () => {
    const { service, tx, fulfilment, prisma } = harness();
    const raw = body("payment.captured", {
      id: "pay_1",
      order_id: "order_1",
      amount: 49900,
      currency: "INR",
    });
    const outcome = await service.handle(raw, sign(raw), "evt_1");
    expect(outcome).toEqual({ status: "processed", orderId });
    expect(tx.commercePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUCCEEDED",
          providerPaymentId: "pay_1",
          webhookEventId: "event",
        }),
      }),
    );
    expect(tx.commerceOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }),
    );
    expect(fulfilment.fulfil).toHaveBeenCalledWith(
      tx,
      orderId,
      expect.objectContaining({ origin: "GATEWAY_WEBHOOK", actorUserId: null }),
    );
    expect(prisma.commerceWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }),
    );
  });

  it("refuses a captured amount that does not match the order total", async () => {
    const { service, tx, fulfilment, prisma } = harness();
    const raw = body("payment.captured", { id: "pay_1", order_id: "order_1", amount: 100 });
    const outcome = await service.handle(raw, sign(raw), "evt_1");
    expect(outcome.status).toBe("failed");
    expect(tx.commerceOrder.update).not.toHaveBeenCalled();
    expect(fulfilment.fulfil).not.toHaveBeenCalled();
    expect(prisma.commerceWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("re-runs idempotent fulfilment when the client verify path already paid the order", async () => {
    const { service, tx, fulfilment } = harness({ orderStatus: "PAID" });
    const raw = body("order.paid", { id: "pay_1", order_id: "order_1", amount: 49900 });
    const outcome = await service.handle(raw, sign(raw), "evt_2");
    expect(outcome.status).toBe("processed");
    expect(tx.commerceOrder.update).not.toHaveBeenCalled();
    expect(fulfilment.fulfil).toHaveBeenCalledOnce();
  });

  it("records failure details on payment.failed without paying the order", async () => {
    const { service, tx, fulfilment } = harness();
    const raw = body("payment.failed", {
      id: "pay_1",
      order_id: "order_1",
      error_code: "BAD_REQUEST_ERROR",
      error_description: "Card declined",
    });
    await service.handle(raw, sign(raw), "evt_3");
    expect(tx.commercePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", failureCode: "BAD_REQUEST_ERROR" }),
      }),
    );
    expect(tx.commerceOrder.update).not.toHaveBeenCalled();
    expect(fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it("ignores events for unknown payment intents", async () => {
    const { service } = harness({ payment: false });
    const raw = body("payment.captured", { id: "pay_x", order_id: "order_x", amount: 1 });
    const outcome = await service.handle(raw, sign(raw), "evt_4");
    expect(outcome.status).toBe("unmatched");
  });
});
