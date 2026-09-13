-- R20-C2c: strict credit accounting. One credit = one full-report grant for one
-- attempt to one principal. The ledger now records the consumption principal,
-- links sponsored candidate entitlements, and carries a shared transfer id for
-- atomic organisation -> counsellor transfers. Additive; the only replaced object
-- is the per-wallet consumption uniqueness index, widened to include the principal
-- so one wallet may spend separate credits on separate principals for one attempt.

ALTER TABLE "commerce_credit_ledger_entries"
  ADD COLUMN "principal_key" VARCHAR(160),
  ADD COLUMN "transfer_id" UUID,
  ADD COLUMN "entitlement_id" UUID;

-- Historical consumptions were all wallet-owner grants; backfill their principal
-- from the linked grant so the new uniqueness rule covers them.
UPDATE "commerce_credit_ledger_entries" l
SET "principal_key" = CASE
  WHEN g."principal_type" = 'ORGANIZATION' THEN 'ORGANIZATION:' || g."principal_organization_id"::text
  ELSE 'USER:' || g."principal_user_id"::text
END
FROM "commerce_report_access_grants" g
WHERE l."report_access_grant_id" = g."id" AND l."event_type" = 'CONSUMPTION' AND l."principal_key" IS NULL;

DROP INDEX IF EXISTS "commerce_credit_ledger_entries_consumption_key";
CREATE UNIQUE INDEX "commerce_credit_ledger_entries_consumption_principal_key"
  ON "commerce_credit_ledger_entries"("wallet_id", "attempt_id", "principal_key")
  WHERE "event_type" = 'CONSUMPTION' AND "attempt_id" IS NOT NULL;
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_consumption_principal_check"
  CHECK ("event_type" <> 'CONSUMPTION' OR "principal_key" IS NOT NULL);

CREATE UNIQUE INDEX "commerce_credit_ledger_entries_entitlement_id_key"
  ON "commerce_credit_ledger_entries"("entitlement_id");
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_entitlement_id_fkey"
  FOREIGN KEY ("entitlement_id") REFERENCES "commerce_entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one OUT and one IN per transfer id; replays with the same id are no-ops.
CREATE UNIQUE INDEX "commerce_credit_ledger_entries_transfer_leg_key"
  ON "commerce_credit_ledger_entries"("transfer_id", "event_type")
  WHERE "transfer_id" IS NOT NULL;
CREATE INDEX "commerce_credit_ledger_entries_transfer_id_idx"
  ON "commerce_credit_ledger_entries"("transfer_id");
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_transfer_check"
  CHECK (("event_type" IN ('TRANSFER_IN', 'TRANSFER_OUT')) = ("transfer_id" IS NOT NULL));
