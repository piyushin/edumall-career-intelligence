-- R20-C2a (pricing authority): platform pricing policy, per-organization delegation,
-- tenant selling prices inside platform floor/ceiling, counsellor professional fees
-- inside platform bounds, and order price snapshots. Additive and forward-only.

CREATE TYPE "CommercePricingSource" AS ENUM ('PLATFORM', 'ORGANIZATION', 'COUNSELLOR');
CREATE TYPE "CommercePriceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Product floor / ceiling / tax -----------------------------------------------

ALTER TABLE "commerce_products"
  ADD COLUMN "min_price_minor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "max_price_minor" INTEGER,
  ADD COLUMN "tax_rate_bps" INTEGER;
ALTER TABLE "commerce_products" ADD CONSTRAINT "commerce_products_price_bounds_check"
  CHECK (
    "min_price_minor" >= 0
    AND ("max_price_minor" IS NULL OR "max_price_minor" >= "min_price_minor")
    AND ("tax_rate_bps" IS NULL OR ("tax_rate_bps" >= 0 AND "tax_rate_bps" <= 10000))
  );

-- Platform policy singleton ----------------------------------------------------

CREATE TABLE "commerce_platform_policies" (
  "id" VARCHAR(40) NOT NULL DEFAULT 'DEFAULT',
  "tenant_coupon_max_discount_bps" INTEGER NOT NULL DEFAULT 5000,
  "default_tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
  "tax_inclusive_pricing" BOOLEAN NOT NULL DEFAULT true,
  "counsellor_fee_pricing_enabled" BOOLEAN NOT NULL DEFAULT false,
  "counsellor_fee_min_minor" INTEGER NOT NULL DEFAULT 0,
  "counsellor_fee_max_minor" INTEGER,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_platform_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_platform_policies_bounds_check" CHECK (
    "tenant_coupon_max_discount_bps" >= 0 AND "tenant_coupon_max_discount_bps" <= 10000
    AND "default_tax_rate_bps" >= 0 AND "default_tax_rate_bps" <= 10000
    AND "counsellor_fee_min_minor" >= 0
    AND ("counsellor_fee_max_minor" IS NULL OR "counsellor_fee_max_minor" >= "counsellor_fee_min_minor")
  )
);
ALTER TABLE "commerce_platform_policies" ADD CONSTRAINT "commerce_platform_policies_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "commerce_platform_policies" ("id", "updated_at") VALUES ('DEFAULT', CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

-- Organization delegation ------------------------------------------------------

CREATE TABLE "commerce_organization_policies" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "delegated_pricing_enabled" BOOLEAN NOT NULL DEFAULT false,
  "coupons_enabled" BOOLEAN NOT NULL DEFAULT false,
  "coupon_max_discount_bps" INTEGER,
  "manual_payment_enabled" BOOLEAN NOT NULL DEFAULT false,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_organization_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_organization_policies_coupon_cap_check" CHECK (
    "coupon_max_discount_bps" IS NULL
    OR ("coupon_max_discount_bps" >= 0 AND "coupon_max_discount_bps" <= 10000)
  )
);
CREATE UNIQUE INDEX "commerce_organization_policies_organization_id_key"
  ON "commerce_organization_policies"("organization_id");
ALTER TABLE "commerce_organization_policies" ADD CONSTRAINT "commerce_organization_policies_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_organization_policies" ADD CONSTRAINT "commerce_organization_policies_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant selling prices --------------------------------------------------------

CREATE TABLE "commerce_organization_prices" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "selling_price_minor" INTEGER NOT NULL,
  "status" "CommercePriceStatus" NOT NULL DEFAULT 'ACTIVE',
  "set_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_organization_prices_pkey" PRIMARY KEY ("id"),
  -- A delegated selling price is never zero; free access is a central complimentary act.
  CONSTRAINT "commerce_organization_prices_positive_check" CHECK ("selling_price_minor" > 0)
);
CREATE UNIQUE INDEX "commerce_organization_prices_organization_id_product_id_key"
  ON "commerce_organization_prices"("organization_id", "product_id");
CREATE INDEX "commerce_organization_prices_product_id_status_idx"
  ON "commerce_organization_prices"("product_id", "status");
ALTER TABLE "commerce_organization_prices" ADD CONSTRAINT "commerce_organization_prices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_organization_prices" ADD CONSTRAINT "commerce_organization_prices_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "commerce_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_organization_prices" ADD CONSTRAINT "commerce_organization_prices_set_by_user_id_fkey"
  FOREIGN KEY ("set_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Counsellor professional fees --------------------------------------------------

CREATE TABLE "commerce_counsellor_fees" (
  "id" UUID NOT NULL,
  "counsellor_user_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "fee_minor" INTEGER NOT NULL,
  "status" "CommercePriceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_counsellor_fees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_counsellor_fees_fee_check" CHECK ("fee_minor" >= 0)
);
CREATE UNIQUE INDEX "commerce_counsellor_fees_counsellor_user_id_organization_id_product_id_key"
  ON "commerce_counsellor_fees"("counsellor_user_id", "organization_id", "product_id");
CREATE INDEX "commerce_counsellor_fees_organization_id_status_idx"
  ON "commerce_counsellor_fees"("organization_id", "status");
ALTER TABLE "commerce_counsellor_fees" ADD CONSTRAINT "commerce_counsellor_fees_counsellor_user_id_fkey"
  FOREIGN KEY ("counsellor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_counsellor_fees" ADD CONSTRAINT "commerce_counsellor_fees_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_counsellor_fees" ADD CONSTRAINT "commerce_counsellor_fees_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "commerce_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order price snapshot -----------------------------------------------------------
-- Historical orders keep the price actually charged; base_price_minor is backfilled
-- from the recorded subtotal so pre-C2a rows remain self-describing.

ALTER TABLE "commerce_orders"
  ADD COLUMN "base_price_minor" INTEGER,
  ADD COLUMN "pricing_source" "CommercePricingSource" NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tax_minor" INTEGER NOT NULL DEFAULT 0;
UPDATE "commerce_orders" SET "base_price_minor" = "subtotal_minor" WHERE "base_price_minor" IS NULL;
ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_tax_check"
  CHECK ("tax_rate_bps" >= 0 AND "tax_rate_bps" <= 10000 AND "tax_minor" >= 0);
