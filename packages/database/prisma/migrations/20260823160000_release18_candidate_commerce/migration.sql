-- Release 18: Candidate commerce, coupons, payments and entitlements.

CREATE TYPE "CommerceProductKind" AS ENUM (
  'REPORT',
  'COUNSELLING',
  'REPORT_AND_COUNSELLING'
);

CREATE TYPE "CommerceProductStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE "CommerceCouponDiscountType" AS ENUM (
  'FREE',
  'PERCENTAGE',
  'FIXED'
);

CREATE TYPE "CommerceCouponStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE "CommerceOrderStatus" AS ENUM (
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED'
);

CREATE TYPE "CommercePaymentStatus" AS ENUM (
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'MANUAL_APPROVED',
  'REFUNDED'
);

CREATE TYPE "CommercePaymentMethod" AS ENUM (
  'ONLINE_GATEWAY',
  'BANK_TRANSFER',
  'UPI',
  'CASH',
  'COUPON',
  'SPONSORED',
  'COMPLIMENTARY'
);

CREATE TYPE "CommerceEntitlementType" AS ENUM (
  'REPORT',
  'COUNSELLING'
);

CREATE TYPE "CommerceEntitlementStatus" AS ENUM (
  'ACTIVE',
  'CONSUMED',
  'REVOKED'
);

CREATE TABLE "commerce_products" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "assessment_version_id" UUID,
  "code" VARCHAR(120) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "kind" "CommerceProductKind" NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'INR',
  "price_minor" INTEGER NOT NULL,
  "status" "CommerceProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commerce_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_coupons" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "product_id" UUID,
  "code" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "discount_type" "CommerceCouponDiscountType" NOT NULL,
  "percentage_bps" INTEGER,
  "fixed_amount_minor" INTEGER,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_until" TIMESTAMP(3),
  "max_redemptions" INTEGER,
  "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  "status" "CommerceCouponStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commerce_coupons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_orders" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "coupon_id" UUID,
  "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PENDING',
  "currency" CHAR(3) NOT NULL,
  "subtotal_minor" INTEGER NOT NULL,
  "discount_minor" INTEGER NOT NULL DEFAULT 0,
  "total_minor" INTEGER NOT NULL,
  "coupon_code_snapshot" VARCHAR(80),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),

  CONSTRAINT "commerce_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_payments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "provider_order_id" VARCHAR(120),
  "provider_payment_id" VARCHAR(120),
  "method" "CommercePaymentMethod" NOT NULL,
  "status" "CommercePaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount_minor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reference" VARCHAR(200),
  "approved_by_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "commerce_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_coupon_redemptions" (
  "id" UUID NOT NULL,
  "coupon_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "discount_minor" INTEGER NOT NULL,
  "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "commerce_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commerce_entitlements" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "order_id" UUID,
  "type" "CommerceEntitlementType" NOT NULL,
  "status" "CommerceEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" VARCHAR(50) NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "commerce_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commerce_products_code_key"
  ON "commerce_products"("code");

CREATE INDEX "commerce_products_organization_id_status_idx"
  ON "commerce_products"("organization_id", "status");

CREATE INDEX "commerce_products_assessment_version_id_status_idx"
  ON "commerce_products"("assessment_version_id", "status");

CREATE INDEX "commerce_products_kind_status_idx"
  ON "commerce_products"("kind", "status");

CREATE UNIQUE INDEX "commerce_coupons_code_key"
  ON "commerce_coupons"("code");

CREATE INDEX "commerce_coupons_organization_id_status_idx"
  ON "commerce_coupons"("organization_id", "status");

CREATE INDEX "commerce_coupons_product_id_status_idx"
  ON "commerce_coupons"("product_id", "status");

CREATE INDEX "commerce_coupons_valid_from_valid_until_idx"
  ON "commerce_coupons"("valid_from", "valid_until");

CREATE INDEX "commerce_orders_organization_id_created_at_idx"
  ON "commerce_orders"("organization_id", "created_at");

CREATE INDEX "commerce_orders_user_id_created_at_idx"
  ON "commerce_orders"("user_id", "created_at");

CREATE INDEX "commerce_orders_attempt_id_created_at_idx"
  ON "commerce_orders"("attempt_id", "created_at");

CREATE INDEX "commerce_orders_status_created_at_idx"
  ON "commerce_orders"("status", "created_at");

CREATE UNIQUE INDEX "commerce_payments_provider_order_id_key"
  ON "commerce_payments"("provider_order_id");

CREATE UNIQUE INDEX "commerce_payments_provider_payment_id_key"
  ON "commerce_payments"("provider_payment_id");

CREATE INDEX "commerce_payments_order_id_status_idx"
  ON "commerce_payments"("order_id", "status");

CREATE INDEX "commerce_payments_status_created_at_idx"
  ON "commerce_payments"("status", "created_at");

CREATE UNIQUE INDEX "commerce_coupon_redemptions_coupon_id_user_id_order_id_key"
  ON "commerce_coupon_redemptions"("coupon_id", "user_id", "order_id");

CREATE INDEX "commerce_coupon_redemptions_coupon_id_redeemed_at_idx"
  ON "commerce_coupon_redemptions"("coupon_id", "redeemed_at");

CREATE INDEX "commerce_coupon_redemptions_user_id_redeemed_at_idx"
  ON "commerce_coupon_redemptions"("user_id", "redeemed_at");

CREATE UNIQUE INDEX "commerce_entitlements_user_id_attempt_id_type_key"
  ON "commerce_entitlements"("user_id", "attempt_id", "type");

CREATE INDEX "commerce_entitlements_organization_id_status_idx"
  ON "commerce_entitlements"("organization_id", "status");

CREATE INDEX "commerce_entitlements_user_id_status_idx"
  ON "commerce_entitlements"("user_id", "status");

CREATE INDEX "commerce_entitlements_attempt_id_status_idx"
  ON "commerce_entitlements"("attempt_id", "status");

ALTER TABLE "commerce_products"
  ADD CONSTRAINT "commerce_products_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_products"
  ADD CONSTRAINT "commerce_products_assessment_version_id_fkey"
  FOREIGN KEY ("assessment_version_id")
  REFERENCES "assessment_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_products"
  ADD CONSTRAINT "commerce_products_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_coupons"
  ADD CONSTRAINT "commerce_coupons_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_coupons"
  ADD CONSTRAINT "commerce_coupons_product_id_fkey"
  FOREIGN KEY ("product_id")
  REFERENCES "commerce_products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_coupons"
  ADD CONSTRAINT "commerce_coupons_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_orders"
  ADD CONSTRAINT "commerce_orders_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_orders"
  ADD CONSTRAINT "commerce_orders_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_orders"
  ADD CONSTRAINT "commerce_orders_attempt_id_fkey"
  FOREIGN KEY ("attempt_id")
  REFERENCES "assessment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_orders"
  ADD CONSTRAINT "commerce_orders_product_id_fkey"
  FOREIGN KEY ("product_id")
  REFERENCES "commerce_products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_orders"
  ADD CONSTRAINT "commerce_orders_coupon_id_fkey"
  FOREIGN KEY ("coupon_id")
  REFERENCES "commerce_coupons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_payments"
  ADD CONSTRAINT "commerce_payments_order_id_fkey"
  FOREIGN KEY ("order_id")
  REFERENCES "commerce_orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_payments"
  ADD CONSTRAINT "commerce_payments_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_coupon_redemptions"
  ADD CONSTRAINT "commerce_coupon_redemptions_coupon_id_fkey"
  FOREIGN KEY ("coupon_id")
  REFERENCES "commerce_coupons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_coupon_redemptions"
  ADD CONSTRAINT "commerce_coupon_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_coupon_redemptions"
  ADD CONSTRAINT "commerce_coupon_redemptions_order_id_fkey"
  FOREIGN KEY ("order_id")
  REFERENCES "commerce_orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_entitlements"
  ADD CONSTRAINT "commerce_entitlements_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_entitlements"
  ADD CONSTRAINT "commerce_entitlements_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_entitlements"
  ADD CONSTRAINT "commerce_entitlements_attempt_id_fkey"
  FOREIGN KEY ("attempt_id")
  REFERENCES "assessment_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commerce_entitlements"
  ADD CONSTRAINT "commerce_entitlements_order_id_fkey"
  FOREIGN KEY ("order_id")
  REFERENCES "commerce_orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
