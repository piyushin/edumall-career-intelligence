-- R19.1A additive security hardening. Existing identifiers and rows are preserved.
CREATE TYPE "SessionPrivilegeType" AS ENUM ('STANDARD', 'SUPER_ADMIN', 'DELEGATED_ADMIN');
CREATE TYPE "AuditOutcome" AS ENUM ('ATTEMPTED', 'SUCCEEDED', 'DENIED', 'FAILED');

ALTER TABLE "sessions"
  ADD COLUMN "membership_id" UUID,
  ADD COLUMN "admin_profile_id" UUID,
  ADD COLUMN "privilege_type" "SessionPrivilegeType" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "audit_logs"
  ADD COLUMN "subject_user_id" UUID,
  ADD COLUMN "request_id" VARCHAR(120),
  ADD COLUMN "correlation_id" VARCHAR(120),
  ADD COLUMN "purpose" VARCHAR(200),
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCEEDED';

-- Attribute compatible live sessions where the evidence is unambiguous. Nullable
-- attribution remains intentional for pre-R19.1 sessions throughout the rollback window.
UPDATE "sessions" AS s
SET "membership_id" = m."id"
FROM "organization_memberships" AS m
WHERE s."organization_id" IS NOT NULL
  AND m."organization_id" = s."organization_id"
  AND m."user_id" = s."user_id";

UPDATE "sessions" AS s
SET "membership_id" = m."id"
FROM "organization_memberships" AS m
JOIN "organizations" AS o ON o."id" = m."organization_id"
WHERE s."scope" = 'PLATFORM'
  AND s."organization_id" IS NULL
  AND m."user_id" = s."user_id"
  AND m."status" = 'ACTIVE'
  AND m."role" IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND o."type" = 'PLATFORM'
  AND o."status" = 'ACTIVE';

UPDATE "sessions" AS s
SET "admin_profile_id" = ap."id",
    "privilege_type" = 'DELEGATED_ADMIN'
FROM "admin_profiles" AS ap
WHERE ap."user_id" = s."user_id"
  AND EXISTS (
    SELECT 1 FROM "organization_memberships" AS m
    WHERE m."id" = s."membership_id" AND m."role" = 'PLATFORM_ADMIN'
  );

UPDATE "sessions" AS s
SET "privilege_type" = 'SUPER_ADMIN'
WHERE EXISTS (
  SELECT 1 FROM "organization_memberships" AS m
  WHERE m."id" = s."membership_id" AND m."role" = 'SUPER_ADMIN'
);

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "sessions_admin_profile_id_fkey" FOREIGN KEY ("admin_profile_id") REFERENCES "admin_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sessions_membership_id_revoked_at_idx" ON "sessions"("membership_id", "revoked_at");
CREATE INDEX "sessions_admin_profile_id_revoked_at_idx" ON "sessions"("admin_profile_id", "revoked_at");
CREATE INDEX "sessions_privilege_type_revoked_at_idx" ON "sessions"("privilege_type", "revoked_at");
CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs"("created_at", "id");
CREATE INDEX "audit_logs_subject_user_id_created_at_idx" ON "audit_logs"("subject_user_id", "created_at");
CREATE INDEX "audit_logs_outcome_created_at_idx" ON "audit_logs"("outcome", "created_at");
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");
