ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';

CREATE TYPE "AdminProfileStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED'
);

CREATE TYPE "AdminScopeType" AS ENUM (
  'PLATFORM',
  'ORGANIZATION'
);

CREATE TABLE "admin_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "AdminProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "title" VARCHAR(160),
  "responsibility" VARCHAR(200),
  "created_by_user_id" UUID NOT NULL,
  "suspended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_profiles_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "admin_permissions" (
  "id" UUID NOT NULL,
  "code" VARCHAR(120) NOT NULL,
  "module" VARCHAR(80) NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_permissions_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "admin_role_templates" (
  "id" UUID NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(400),
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_role_templates_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "admin_role_template_permissions" (
  "role_template_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,

  CONSTRAINT "admin_role_template_permissions_pkey"
    PRIMARY KEY ("role_template_id", "permission_id")
);

CREATE TABLE "admin_role_assignments" (
  "id" UUID NOT NULL,
  "admin_profile_id" UUID NOT NULL,
  "role_template_id" UUID NOT NULL,
  "scope_type" "AdminScopeType" NOT NULL,
  "organization_id" UUID,
  "granted_by_user_id" UUID NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),

  CONSTRAINT "admin_role_assignments_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "admin_role_assignment_scope_check"
    CHECK (
      ("scope_type" = 'PLATFORM' AND "organization_id" IS NULL)
      OR
      ("scope_type" = 'ORGANIZATION' AND "organization_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "admin_profiles_user_id_key"
  ON "admin_profiles"("user_id");

CREATE INDEX "admin_profiles_status_idx"
  ON "admin_profiles"("status");

CREATE INDEX "admin_profiles_created_by_user_id_created_at_idx"
  ON "admin_profiles"("created_by_user_id", "created_at");

CREATE UNIQUE INDEX "admin_permissions_code_key"
  ON "admin_permissions"("code");

CREATE INDEX "admin_permissions_module_action_idx"
  ON "admin_permissions"("module", "action");

CREATE UNIQUE INDEX "admin_role_templates_code_key"
  ON "admin_role_templates"("code");

CREATE INDEX "admin_role_templates_is_active_idx"
  ON "admin_role_templates"("is_active");

CREATE INDEX "admin_role_templates_created_by_user_id_created_at_idx"
  ON "admin_role_templates"("created_by_user_id", "created_at");

CREATE INDEX "admin_role_template_permissions_permission_id_idx"
  ON "admin_role_template_permissions"("permission_id");

CREATE INDEX "admin_role_assignments_admin_profile_id_revoked_at_idx"
  ON "admin_role_assignments"("admin_profile_id", "revoked_at");

CREATE INDEX "admin_role_assignments_role_template_id_revoked_at_idx"
  ON "admin_role_assignments"("role_template_id", "revoked_at");

CREATE INDEX "admin_role_assignments_organization_id_revoked_at_idx"
  ON "admin_role_assignments"("organization_id", "revoked_at");

CREATE INDEX "admin_role_assignments_granted_by_user_id_granted_at_idx"
  ON "admin_role_assignments"("granted_by_user_id", "granted_at");

CREATE UNIQUE INDEX "admin_role_assignments_active_platform_key"
  ON "admin_role_assignments"(
    "admin_profile_id",
    "role_template_id"
  )
  WHERE
    "scope_type" = 'PLATFORM'
    AND "revoked_at" IS NULL;

CREATE UNIQUE INDEX "admin_role_assignments_active_organization_key"
  ON "admin_role_assignments"(
    "admin_profile_id",
    "role_template_id",
    "organization_id"
  )
  WHERE
    "scope_type" = 'ORGANIZATION'
    AND "revoked_at" IS NULL;

ALTER TABLE "admin_profiles"
  ADD CONSTRAINT "admin_profiles_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "admin_profiles"
  ADD CONSTRAINT "admin_profiles_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_templates"
  ADD CONSTRAINT "admin_role_templates_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_template_permissions"
  ADD CONSTRAINT "admin_role_template_permissions_role_template_id_fkey"
  FOREIGN KEY ("role_template_id")
  REFERENCES "admin_role_templates"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_template_permissions"
  ADD CONSTRAINT "admin_role_template_permissions_permission_id_fkey"
  FOREIGN KEY ("permission_id")
  REFERENCES "admin_permissions"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_assignments"
  ADD CONSTRAINT "admin_role_assignments_admin_profile_id_fkey"
  FOREIGN KEY ("admin_profile_id")
  REFERENCES "admin_profiles"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_assignments"
  ADD CONSTRAINT "admin_role_assignments_role_template_id_fkey"
  FOREIGN KEY ("role_template_id")
  REFERENCES "admin_role_templates"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_assignments"
  ADD CONSTRAINT "admin_role_assignments_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "admin_role_assignments"
  ADD CONSTRAINT "admin_role_assignments_granted_by_user_id_fkey"
  FOREIGN KEY ("granted_by_user_id")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
