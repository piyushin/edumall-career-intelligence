import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260913000000_r20_c2a_commerce_orders_fulfilment/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const model = (name: string) => Prisma.dmmf.datamodel.models.find((item) => item.name === name);

describe("R20-C2a commerce schema", () => {
  it("adds backend-controlled catalogue audience and unit quantity", () => {
    const product = model("CommerceProduct");
    expect(product?.fields.some((field) => field.name === "audience")).toBe(true);
    expect(product?.fields.some((field) => field.name === "unitQuantity")).toBe(true);
    expect(migration).toContain('CHECK ("unit_quantity" >= 1)');
    expect(migration).toContain('CHECK ("price_minor" >= 0)');
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'REPORT_CREDIT_PACK'");
  });

  it("lets orders represent organisation and counsellor purchasers without an attempt", () => {
    const order = model("CommerceOrder");
    expect(order?.fields.find((field) => field.name === "attemptId")?.isRequired).toBe(false);
    expect(order?.fields.some((field) => field.name === "purchaserType")).toBe(true);
    expect(order?.fields.some((field) => field.name === "creditWalletId")).toBe(true);
    expect(migration).toContain('CONSTRAINT "commerce_orders_purchaser_check"');
    expect(migration).toContain(
      '"purchaser_type" = \'CANDIDATE\' AND "attempt_id" IS NOT NULL AND "credit_wallet_id" IS NULL',
    );
  });

  it("tracks fulfilment separately from payment and backfills historical paid orders", () => {
    expect(model("CommerceOrder")?.fields.some((field) => field.name === "fulfilmentStatus")).toBe(
      true,
    );
    expect(migration).toContain("SET \"fulfilment_status\" = 'FULFILLED'");
    expect(migration).toContain("WHERE \"status\" = 'PAID'");
  });

  it("journals provider webhook events exactly once and links payments to them", () => {
    expect(model("CommerceWebhookEvent")).toBeDefined();
    expect(migration).toContain('"commerce_webhook_events_provider_event_id_key"');
    expect(migration).toContain('"commerce_payments_webhook_event_id_key"');
    expect(migration).toContain('ADD COLUMN "failure_code" VARCHAR(120)');
  });

  it("prevents a credit purchase from being ledgered twice per order", () => {
    expect(migration).toContain('"commerce_credit_ledger_entries_purchase_order_key"');
    expect(migration).toContain("WHERE \"event_type\" = 'PURCHASE'");
  });

  it("remains additive for historical commerce and release data", () => {
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM/i);
    expect(migration).not.toMatch(/"assessment_report_releases"/);
  });
});
