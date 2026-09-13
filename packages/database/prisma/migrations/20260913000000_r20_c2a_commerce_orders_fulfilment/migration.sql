-- R20-C2a: backend-controlled catalogue audience/unit quantity, purchaser-aware orders,
-- idempotent fulfilment state, payment failure/refund evidence, and provider webhook
-- event journal. This migration is additive; existing candidate orders, payments,
-- coupons, entitlements and credit ledger rows remain valid and are backfilled in place.

ALTER TYPE "CommerceProductKind" ADD VALUE IF NOT EXISTS 'REPORT_CREDIT_PACK';

CREATE TYPE "CommerceProductAudience" AS ENUM ('CANDIDATE', 'ORGANIZATION', 'COUNSELLOR');
CREATE TYPE "CommerceOrderPurchaserType" AS ENUM ('CANDIDATE', 'ORGANIZATION', 'COUNSELLOR');
CREATE TYPE "CommerceOrderFulfilmentStatus" AS ENUM ('PENDING', 'FULFILLED', 'FAILED');
CREATE TYPE "CommerceWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- Catalogue -------------------------------------------------------------------

ALTER TABLE "commerce_products"
  ADD COLUMN "audience" "CommerceProductAudience" NOT NULL DEFAULT 'CANDIDATE',
  ADD COLUMN "unit_quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_unit_quantity_check"
  CHECK ("unit_quantity" >= 1);
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_price_minor_check"
  CHECK ("price_minor" >= 0);
CREATE INDEX "commerce_products_audience_status_idx" ON "commerce_products"("audience", "status");

ALTER TABLE "commerce_coupons" ADD COLUMN "applies_to_kind" "CommerceProductKind";

-- Orders ----------------------------------------------------------------------

ALTER TABLE "commerce_orders" ALTER COLUMN "attempt_id" DROP NOT NULL;
ALTER TABLE "commerce_orders"
  ADD COLUMN "purchaser_type" "CommerceOrderPurchaserType" NOT NULL DEFAULT 'CANDIDATE',
  ADD COLUMN "credit_wallet_id" UUID,
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "fulfilment_status" "CommerceOrderFulfilmentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "fulfilled_at" TIMESTAMP(3),
  ADD COLUMN "refunded_at" TIMESTAMP(3);

-- Historical paid candidate orders granted their entitlements inside the payment
-- transaction, so they are already fulfilled.
UPDATE "commerce_orders"
SET "fulfilment_status" = 'FULFILLED', "fulfilled_at" = COALESCE("paid_at", "updated_at")
WHERE "status" = 'PAID';

ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_quantity_check"
  CHECK ("quantity" >= 1);
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_purchaser_check"
  CHECK (
    ("purchaser_type" = 'CANDIDATE' AND "attempt_id" IS NOT NULL AND "credit_wallet_id" IS NULL)
    OR ("purchaser_type" IN ('ORGANIZATION', 'COUNSELLOR') AND "credit_wallet_id" IS NOT NULL)
  );
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_amounts_check"
  CHECK ("subtotal_minor" >= 0 AND "discount_minor" >= 0 AND "total_minor" >= 0
    AND "discount_minor" <= "subtotal_minor");
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_credit_wallet_id_fkey"
  FOREIGN KEY ("credit_wallet_id") REFERENCES "commerce_credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "commerce_orders_status_fulfilment_status_idx" ON "commerce_orders"("status", "fulfilment_status");
CREATE INDEX "commerce_orders_credit_wallet_id_idx" ON "commerce_orders"("credit_wallet_id");

-- Webhook journal ---------------------------------------------------------------

CREATE TABLE "commerce_webhook_events" (
  "id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "event_id" VARCHAR(160) NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "status" "CommerceWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "signature_valid" BOOLEAN NOT NULL,
  "payload" JSONB NOT NULL,
  "error_message" VARCHAR(500),
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "commerce_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commerce_webhook_events_provider_event_id_key"
  ON "commerce_webhook_events"("provider", "event_id");
CREATE INDEX "commerce_webhook_events_status_received_at_idx"
  ON "commerce_webhook_events"("status", "received_at");

-- Payments ----------------------------------------------------------------------

ALTER TABLE "commerce_payments"
  ADD COLUMN "webhook_event_id" UUID,
  ADD COLUMN "failure_code" VARCHAR(120),
  ADD COLUMN "failure_message" VARCHAR(500);
CREATE UNIQUE INDEX "commerce_payments_webhook_event_id_key" ON "commerce_payments"("webhook_event_id");
ALTER TABLE "commerce_payments" ADD CONSTRAINT "commerce_payments_webhook_event_id_fkey"
  FOREIGN KEY ("webhook_event_id") REFERENCES "commerce_webhook_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Credit purchases are fulfilled at most once per order at the database level.
CREATE UNIQUE INDEX "commerce_credit_ledger_entries_purchase_order_key"
  ON "commerce_credit_ledger_entries"("order_id") WHERE "event_type" = 'PURCHASE';
