-- R20-A: automatic report configuration, durable generation state, report access,
-- report-credit accounting, counsellor assignment, and canonical candidate phone.
-- This migration is intentionally additive and preserves assessment_report_releases.

ALTER TABLE "users" ADD COLUMN "phone_e164" VARCHAR(16);
ALTER TABLE "users" ADD CONSTRAINT "users_phone_e164_check"
  CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^\+[1-9][0-9]{7,14}$');
CREATE INDEX "users_phone_e164_idx" ON "users"("phone_e164");

CREATE TYPE "AssessmentReportConfigurationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AssessmentReportGenerationStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'GENERATED', 'BLOCKED_CONFIGURATION', 'FAILED'
);
CREATE TYPE "CommerceReportPrincipalType" AS ENUM ('USER', 'ORGANIZATION');
CREATE TYPE "CommerceReportAccessGrantSource" AS ENUM ('CREDIT', 'COUPON', 'ADMIN', 'CONTRACT');
CREATE TYPE "CommerceReportAccessGrantStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "CommerceCreditWalletOwnerType" AS ENUM ('USER', 'ORGANIZATION');
CREATE TYPE "CommerceCreditType" AS ENUM ('REPORT_ACCESS');
CREATE TYPE "CommerceCreditWalletStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "CommerceCreditLedgerEventType" AS ENUM (
  'PURCHASE', 'ADMIN_ALLOTMENT', 'TRANSFER_IN', 'TRANSFER_OUT',
  'CONSUMPTION', 'REVERSAL', 'REVOCATION'
);
CREATE TYPE "CandidateCounsellorAssignmentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'COMPLETED');

CREATE TABLE "assessment_report_configurations" (
  "id" UUID NOT NULL,
  "assessment_version_id" UUID NOT NULL,
  "norm_group_id" UUID NOT NULL,
  "interpretation_set_id" UUID NOT NULL,
  "career_fit_model_id" UUID NOT NULL,
  "report_template_version" VARCHAR(60) NOT NULL,
  "status" "AssessmentReportConfigurationStatus" NOT NULL DEFAULT 'INACTIVE',
  "configured_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessment_report_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessment_report_configurations_active_version_key"
  ON "assessment_report_configurations"("assessment_version_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "assessment_report_configurations_assessment_version_id_status_idx"
  ON "assessment_report_configurations"("assessment_version_id", "status");
CREATE INDEX "assessment_report_configurations_norm_group_id_idx" ON "assessment_report_configurations"("norm_group_id");
CREATE INDEX "assessment_report_configurations_interpretation_set_id_idx" ON "assessment_report_configurations"("interpretation_set_id");
CREATE INDEX "assessment_report_configurations_career_fit_model_id_idx" ON "assessment_report_configurations"("career_fit_model_id");
CREATE INDEX "assessment_report_configurations_configured_by_user_id_created_at_idx"
  ON "assessment_report_configurations"("configured_by_user_id", "created_at");

CREATE TABLE "assessment_report_generations" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "configuration_id" UUID,
  "report_data_snapshot_id" UUID,
  "status" "AssessmentReportGenerationStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error_code" VARCHAR(120),
  "last_error_message" VARCHAR(1000),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessment_report_generations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_report_generations_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "assessment_report_generations_generated_check" CHECK (
    "status" <> 'GENERATED' OR ("report_data_snapshot_id" IS NOT NULL AND "completed_at" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "assessment_report_generations_attempt_id_key" ON "assessment_report_generations"("attempt_id");
CREATE INDEX "assessment_report_generations_status_updated_at_idx" ON "assessment_report_generations"("status", "updated_at");
CREATE INDEX "assessment_report_generations_configuration_id_idx" ON "assessment_report_generations"("configuration_id");
CREATE INDEX "assessment_report_generations_report_data_snapshot_id_idx" ON "assessment_report_generations"("report_data_snapshot_id");

CREATE TABLE "commerce_credit_wallets" (
  "id" UUID NOT NULL,
  "owner_type" "CommerceCreditWalletOwnerType" NOT NULL,
  "owner_user_id" UUID,
  "owner_organization_id" UUID,
  "credit_type" "CommerceCreditType" NOT NULL DEFAULT 'REPORT_ACCESS',
  "status" "CommerceCreditWalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_balance" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commerce_credit_wallets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_credit_wallets_owner_check" CHECK (
    ("owner_type" = 'USER' AND "owner_user_id" IS NOT NULL AND "owner_organization_id" IS NULL)
    OR
    ("owner_type" = 'ORGANIZATION' AND "owner_user_id" IS NULL AND "owner_organization_id" IS NOT NULL)
  ),
  CONSTRAINT "commerce_credit_wallets_balance_check" CHECK ("current_balance" >= 0)
);
CREATE UNIQUE INDEX "commerce_credit_wallets_user_owner_key"
  ON "commerce_credit_wallets"("owner_user_id", "credit_type") WHERE "owner_type" = 'USER';
CREATE UNIQUE INDEX "commerce_credit_wallets_organization_owner_key"
  ON "commerce_credit_wallets"("owner_organization_id", "credit_type") WHERE "owner_type" = 'ORGANIZATION';
CREATE INDEX "commerce_credit_wallets_owner_user_id_status_idx" ON "commerce_credit_wallets"("owner_user_id", "status");
CREATE INDEX "commerce_credit_wallets_owner_organization_id_status_idx" ON "commerce_credit_wallets"("owner_organization_id", "status");
CREATE INDEX "commerce_credit_wallets_status_idx" ON "commerce_credit_wallets"("status");

CREATE TABLE "commerce_credit_ledger_entries" (
  "id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "event_type" "CommerceCreditLedgerEventType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "attempt_id" UUID,
  "order_id" UUID,
  "report_access_grant_id" UUID,
  "actor_user_id" UUID NOT NULL,
  "reference" VARCHAR(200),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commerce_credit_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_credit_ledger_entries_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "commerce_credit_ledger_entries_delta_check" CHECK (ABS("delta") = "quantity"),
  CONSTRAINT "commerce_credit_ledger_entries_balance_check" CHECK ("balance_after" >= 0),
  CONSTRAINT "commerce_credit_ledger_entries_direction_check" CHECK (
    ("event_type" IN ('PURCHASE', 'ADMIN_ALLOTMENT', 'TRANSFER_IN') AND "delta" > 0)
    OR ("event_type" IN ('TRANSFER_OUT', 'CONSUMPTION', 'REVOCATION') AND "delta" < 0)
    OR "event_type" = 'REVERSAL'
  )
);
CREATE INDEX "commerce_credit_ledger_entries_wallet_id_created_at_idx" ON "commerce_credit_ledger_entries"("wallet_id", "created_at");
CREATE INDEX "commerce_credit_ledger_entries_attempt_id_event_type_idx" ON "commerce_credit_ledger_entries"("attempt_id", "event_type");
CREATE INDEX "commerce_credit_ledger_entries_order_id_idx" ON "commerce_credit_ledger_entries"("order_id");
CREATE INDEX "commerce_credit_ledger_entries_actor_user_id_created_at_idx" ON "commerce_credit_ledger_entries"("actor_user_id", "created_at");
CREATE UNIQUE INDEX "commerce_credit_ledger_entries_report_access_grant_id_key" ON "commerce_credit_ledger_entries"("report_access_grant_id");
CREATE UNIQUE INDEX "commerce_credit_ledger_entries_consumption_key"
  ON "commerce_credit_ledger_entries"("wallet_id", "attempt_id")
  WHERE "event_type" = 'CONSUMPTION' AND "attempt_id" IS NOT NULL;

CREATE TABLE "commerce_report_access_grants" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "principal_type" "CommerceReportPrincipalType" NOT NULL,
  "principal_user_id" UUID,
  "principal_organization_id" UUID,
  "source" "CommerceReportAccessGrantSource" NOT NULL,
  "status" "CommerceReportAccessGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "granted_by_user_id" UUID NOT NULL,
  "credit_ledger_entry_id" UUID,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "commerce_report_access_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_report_access_grants_principal_check" CHECK (
    ("principal_type" = 'USER' AND "principal_user_id" IS NOT NULL AND "principal_organization_id" IS NULL)
    OR
    ("principal_type" = 'ORGANIZATION' AND "principal_user_id" IS NULL AND "principal_organization_id" IS NOT NULL)
  ),
  CONSTRAINT "commerce_report_access_grants_status_check" CHECK (
    ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL)
  )
);
CREATE UNIQUE INDEX "commerce_report_access_grants_credit_ledger_entry_id_key" ON "commerce_report_access_grants"("credit_ledger_entry_id");
CREATE UNIQUE INDEX "commerce_report_access_grants_active_user_key"
  ON "commerce_report_access_grants"("attempt_id", "principal_user_id")
  WHERE "status" = 'ACTIVE' AND "principal_type" = 'USER';
CREATE UNIQUE INDEX "commerce_report_access_grants_active_organization_key"
  ON "commerce_report_access_grants"("attempt_id", "principal_organization_id")
  WHERE "status" = 'ACTIVE' AND "principal_type" = 'ORGANIZATION';
CREATE INDEX "commerce_report_access_grants_attempt_id_status_idx" ON "commerce_report_access_grants"("attempt_id", "status");
CREATE INDEX "commerce_report_access_grants_principal_user_id_status_idx" ON "commerce_report_access_grants"("principal_user_id", "status");
CREATE INDEX "commerce_report_access_grants_principal_organization_id_status_idx" ON "commerce_report_access_grants"("principal_organization_id", "status");
CREATE INDEX "commerce_report_access_grants_granted_by_user_id_granted_at_idx" ON "commerce_report_access_grants"("granted_by_user_id", "granted_at");
CREATE INDEX "commerce_report_access_grants_expires_at_idx" ON "commerce_report_access_grants"("expires_at");

CREATE TABLE "candidate_counsellor_assignments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "candidate_user_id" UUID NOT NULL,
  "counsellor_user_id" UUID NOT NULL,
  "status" "CandidateCounsellorAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assigned_by_user_id" UUID NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "consented_at" TIMESTAMP(3),
  "consent_metadata" JSONB,
  "metadata" JSONB,
  CONSTRAINT "candidate_counsellor_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "candidate_counsellor_assignments_distinct_users_check" CHECK ("candidate_user_id" <> "counsellor_user_id"),
  CONSTRAINT "candidate_counsellor_assignments_status_check" CHECK (
    ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL)
  )
);
CREATE UNIQUE INDEX "candidate_counsellor_assignments_active_key"
  ON "candidate_counsellor_assignments"("organization_id", "candidate_user_id", "counsellor_user_id")
  WHERE "status" = 'ACTIVE';
CREATE INDEX "candidate_counsellor_assignments_organization_id_status_idx" ON "candidate_counsellor_assignments"("organization_id", "status");
CREATE INDEX "candidate_counsellor_assignments_candidate_user_id_status_idx" ON "candidate_counsellor_assignments"("candidate_user_id", "status");
CREATE INDEX "candidate_counsellor_assignments_counsellor_user_id_organization_id_status_idx"
  ON "candidate_counsellor_assignments"("counsellor_user_id", "organization_id", "status");
CREATE INDEX "candidate_counsellor_assignments_assigned_by_user_id_assigned_at_idx"
  ON "candidate_counsellor_assignments"("assigned_by_user_id", "assigned_at");

ALTER TABLE "assessment_report_configurations" ADD CONSTRAINT "assessment_report_configurations_assessment_version_id_fkey" FOREIGN KEY ("assessment_version_id") REFERENCES "assessment_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_configurations" ADD CONSTRAINT "assessment_report_configurations_norm_group_id_fkey" FOREIGN KEY ("norm_group_id") REFERENCES "assessment_norm_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_configurations" ADD CONSTRAINT "assessment_report_configurations_interpretation_set_id_fkey" FOREIGN KEY ("interpretation_set_id") REFERENCES "assessment_interpretation_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_configurations" ADD CONSTRAINT "assessment_report_configurations_career_fit_model_id_fkey" FOREIGN KEY ("career_fit_model_id") REFERENCES "career_fit_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_configurations" ADD CONSTRAINT "assessment_report_configurations_configured_by_user_id_fkey" FOREIGN KEY ("configured_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_generations" ADD CONSTRAINT "assessment_report_generations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_generations" ADD CONSTRAINT "assessment_report_generations_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "assessment_report_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_report_generations" ADD CONSTRAINT "assessment_report_generations_report_data_snapshot_id_fkey" FOREIGN KEY ("report_data_snapshot_id") REFERENCES "assessment_report_data_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_wallets" ADD CONSTRAINT "commerce_credit_wallets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_wallets" ADD CONSTRAINT "commerce_credit_wallets_owner_organization_id_fkey" FOREIGN KEY ("owner_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "commerce_credit_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_report_access_grants" ADD CONSTRAINT "commerce_report_access_grants_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_report_access_grants" ADD CONSTRAINT "commerce_report_access_grants_principal_user_id_fkey" FOREIGN KEY ("principal_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_report_access_grants" ADD CONSTRAINT "commerce_report_access_grants_principal_organization_id_fkey" FOREIGN KEY ("principal_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_report_access_grants" ADD CONSTRAINT "commerce_report_access_grants_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_report_access_grants" ADD CONSTRAINT "commerce_report_access_grants_credit_ledger_entry_id_fkey" FOREIGN KEY ("credit_ledger_entry_id") REFERENCES "commerce_credit_ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commerce_credit_ledger_entries" ADD CONSTRAINT "commerce_credit_ledger_entries_report_access_grant_id_fkey" FOREIGN KEY ("report_access_grant_id") REFERENCES "commerce_report_access_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_counsellor_assignments" ADD CONSTRAINT "candidate_counsellor_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_counsellor_assignments" ADD CONSTRAINT "candidate_counsellor_assignments_candidate_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_counsellor_assignments" ADD CONSTRAINT "candidate_counsellor_assignments_counsellor_user_id_fkey" FOREIGN KEY ("counsellor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_counsellor_assignments" ADD CONSTRAINT "candidate_counsellor_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_commerce_credit_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'commerce credit ledger entries are immutable' USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "commerce_credit_ledger_entries_immutable_update"
  BEFORE UPDATE ON "commerce_credit_ledger_entries" FOR EACH ROW EXECUTE FUNCTION prevent_commerce_credit_ledger_mutation();
CREATE TRIGGER "commerce_credit_ledger_entries_immutable_delete"
  BEFORE DELETE ON "commerce_credit_ledger_entries" FOR EACH ROW EXECUTE FUNCTION prevent_commerce_credit_ledger_mutation();

INSERT INTO "admin_permissions" ("id", "code", "module", "action", "description", "created_at") VALUES
  (gen_random_uuid(), 'report.search', 'report', 'search', 'Search report metadata within authorized scope.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'report.view.full', 'report', 'view_full', 'Open complete reports within authorized administrative scope.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'report.download', 'report', 'download', 'Download complete reports when report access policy permits.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'report.credit.view', 'report_credit', 'view', 'View report-credit wallets and immutable ledger entries.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'report.credit.manage', 'report_credit', 'manage', 'Allot, revoke, and consume report credits.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'counsellor.assignment.view', 'counsellor_assignment', 'view', 'View candidate-to-counsellor assignments.', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'counsellor.assignment.manage', 'counsellor_assignment', 'manage', 'Create and revoke candidate-to-counsellor assignments.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "admin_role_template_permissions" ("role_template_id", "permission_id")
SELECT role_template."id", permission."id"
FROM "admin_role_templates" role_template
JOIN "admin_permissions" permission ON (
  (role_template."code" = 'ACADEMIC_CAREER_ADMIN' AND permission."code" IN ('report.search', 'report.view.full', 'report.download'))
  OR (role_template."code" = 'FINANCE_PARTNER_ADMIN' AND permission."code" IN ('report.credit.view', 'report.credit.manage'))
  OR (role_template."code" = 'COUNSELLING_ADMIN' AND permission."code" IN ('report.search', 'report.view.full', 'report.download', 'counsellor.assignment.view', 'counsellor.assignment.manage'))
  OR (role_template."code" = 'INSTITUTION_ADMIN' AND permission."code" IN ('report.search', 'report.credit.view', 'report.credit.manage', 'counsellor.assignment.view', 'counsellor.assignment.manage'))
  OR (role_template."code" = 'AUDIT_COMPLIANCE_ADMIN' AND permission."code" IN ('report.search', 'report.credit.view'))
)
ON CONFLICT ("role_template_id", "permission_id") DO NOTHING;
