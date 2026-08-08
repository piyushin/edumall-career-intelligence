-- Phase 2A: stable assessment identities and immutable published versions.

CREATE TYPE "AssessmentDefinitionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AssessmentVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

CREATE TABLE "assessment_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "code" VARCHAR(120) NOT NULL,
    "status" "AssessmentDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "assessment_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_definitions_archive_state_check" CHECK (
        ("status" = 'ACTIVE' AND "archived_at" IS NULL)
        OR ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL)
    )
);

CREATE TABLE "assessment_versions" (
    "id" UUID NOT NULL,
    "assessment_definition_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "AssessmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "delivery_config" JSONB,
    "scoring_config" JSONB,
    "created_by_user_id" UUID,
    "published_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),

    CONSTRAINT "assessment_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_versions_version_number_check" CHECK ("version_number" > 0),
    CONSTRAINT "assessment_versions_lifecycle_check" CHECK (
        ("status" = 'DRAFT' AND "published_at" IS NULL AND "retired_at" IS NULL)
        OR ("status" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "retired_at" IS NULL)
        OR ("status" = 'RETIRED' AND "published_at" IS NOT NULL AND "retired_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "assessment_definitions_code_key"
    ON "assessment_definitions"("code");
CREATE INDEX "assessment_definitions_organization_id_status_idx"
    ON "assessment_definitions"("organization_id", "status");
CREATE INDEX "assessment_definitions_status_idx"
    ON "assessment_definitions"("status");

CREATE UNIQUE INDEX "assessment_versions_assessment_definition_id_version_number_key"
    ON "assessment_versions"("assessment_definition_id", "version_number");
CREATE INDEX "assessment_versions_assessment_definition_id_status_idx"
    ON "assessment_versions"("assessment_definition_id", "status");
CREATE INDEX "assessment_versions_status_published_at_idx"
    ON "assessment_versions"("status", "published_at");

ALTER TABLE "assessment_definitions"
    ADD CONSTRAINT "assessment_definitions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_definitions"
    ADD CONSTRAINT "assessment_definitions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_versions"
    ADD CONSTRAINT "assessment_versions_assessment_definition_id_fkey"
    FOREIGN KEY ("assessment_definition_id") REFERENCES "assessment_definitions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_versions"
    ADD CONSTRAINT "assessment_versions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_versions"
    ADD CONSTRAINT "assessment_versions_published_by_user_id_fkey"
    FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve psychometric/audit reproducibility:
-- a published version may only transition to RETIRED;
-- a retired version cannot be changed; published/retired versions cannot be deleted.
CREATE FUNCTION "protect_assessment_version_history"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD."status" <> 'DRAFT' THEN
            RAISE EXCEPTION 'Published or retired assessment versions cannot be deleted';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD."status" = 'RETIRED' THEN
        RAISE EXCEPTION 'Retired assessment versions are immutable';
    END IF;

    IF OLD."status" = 'DRAFT' AND NEW."status" = 'RETIRED' THEN
        RAISE EXCEPTION 'Draft assessment versions must be published before retirement';
    END IF;

    IF OLD."status" = 'PUBLISHED' THEN
        IF NEW."status" <> 'RETIRED' THEN
            RAISE EXCEPTION 'Published assessment versions may only transition to retired';
        END IF;

        IF NEW."assessment_definition_id" IS DISTINCT FROM OLD."assessment_definition_id"
           OR NEW."version_number" IS DISTINCT FROM OLD."version_number"
           OR NEW."title" IS DISTINCT FROM OLD."title"
           OR NEW."description" IS DISTINCT FROM OLD."description"
           OR NEW."instructions" IS DISTINCT FROM OLD."instructions"
           OR NEW."delivery_config" IS DISTINCT FROM OLD."delivery_config"
           OR NEW."scoring_config" IS DISTINCT FROM OLD."scoring_config"
           OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
           OR NEW."published_by_user_id" IS DISTINCT FROM OLD."published_by_user_id"
           OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
           OR NEW."published_at" IS DISTINCT FROM OLD."published_at" THEN
            RAISE EXCEPTION 'Published assessment version content is immutable';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_versions_history_guard"
BEFORE UPDATE OR DELETE ON "assessment_versions"
FOR EACH ROW EXECUTE FUNCTION "protect_assessment_version_history"();
