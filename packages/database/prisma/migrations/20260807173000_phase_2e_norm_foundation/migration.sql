-- Phase 2E: versioned norm-set foundation.
-- No normative values are seeded by this migration.

CREATE TYPE "AssessmentNormSetStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'RETIRED'
);

CREATE TABLE "assessment_norm_sets" (
    "id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "norm_version" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "source_reference" TEXT,
    "population_metadata" JSONB,
    "status" "AssessmentNormSetStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_norm_sets_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_norm_sets_lifecycle_check"
        CHECK (
            (
                "status" = 'DRAFT'
                AND "published_at" IS NULL
                AND "retired_at" IS NULL
            )
            OR
            (
                "status" = 'PUBLISHED'
                AND "published_at" IS NOT NULL
                AND "retired_at" IS NULL
            )
            OR
            (
                "status" = 'RETIRED'
                AND "published_at" IS NOT NULL
                AND "retired_at" IS NOT NULL
            )
        )
);

CREATE TABLE "assessment_norm_groups" (
    "id" UUID NOT NULL,
    "norm_set_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "criteria" JSONB,
    "sample_size" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_norm_groups_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_norm_groups_sample_size_check"
        CHECK ("sample_size" IS NULL OR "sample_size" > 0)
);

CREATE TABLE "assessment_construct_norm_tables" (
    "id" UUID NOT NULL,
    "norm_group_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_construct_norm_tables_pkey"
        PRIMARY KEY ("id")
);

CREATE TABLE "assessment_norm_lookup_rows" (
    "id" UUID NOT NULL,
    "construct_norm_table_id" UUID NOT NULL,
    "raw_score_min" DECIMAL(20,8) NOT NULL,
    "raw_score_max" DECIMAL(20,8) NOT NULL,
    "standardized_score" DECIMAL(20,8),
    "percentile" DECIMAL(8,4),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_norm_lookup_rows_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_norm_lookup_rows_range_check"
        CHECK ("raw_score_max" >= "raw_score_min"),

    CONSTRAINT "assessment_norm_lookup_rows_percentile_check"
        CHECK (
            "percentile" IS NULL
            OR (
                "percentile" >= 0
                AND "percentile" <= 100
            )
        )
);

CREATE UNIQUE INDEX
    "assessment_norm_sets_assessment_version_id_norm_version_key"
ON "assessment_norm_sets"(
    "assessment_version_id",
    "norm_version"
);

CREATE INDEX "assessment_norm_sets_assessment_version_id_status_idx"
    ON "assessment_norm_sets"("assessment_version_id", "status");

CREATE INDEX "assessment_norm_sets_status_published_at_idx"
    ON "assessment_norm_sets"("status", "published_at");

CREATE UNIQUE INDEX "assessment_norm_groups_norm_set_id_code_key"
    ON "assessment_norm_groups"("norm_set_id", "code");

CREATE INDEX "assessment_norm_groups_norm_set_id_idx"
    ON "assessment_norm_groups"("norm_set_id");

CREATE UNIQUE INDEX
    "assessment_construct_norm_tables_norm_group_id_assessment_construct_id_key"
ON "assessment_construct_norm_tables"(
    "norm_group_id",
    "assessment_construct_id"
);

CREATE INDEX
    "assessment_construct_norm_tables_assessment_construct_id_idx"
ON "assessment_construct_norm_tables"(
    "assessment_construct_id"
);

CREATE UNIQUE INDEX
    "assessment_norm_lookup_rows_construct_norm_table_id_raw_score_min_raw_score_max_key"
ON "assessment_norm_lookup_rows"(
    "construct_norm_table_id",
    "raw_score_min",
    "raw_score_max"
);

CREATE INDEX
    "assessment_norm_lookup_rows_lookup_idx"
ON "assessment_norm_lookup_rows"(
    "construct_norm_table_id",
    "raw_score_min",
    "raw_score_max"
);

ALTER TABLE "assessment_norm_sets"
    ADD CONSTRAINT "assessment_norm_sets_assessment_version_id_fkey"
    FOREIGN KEY ("assessment_version_id")
    REFERENCES "assessment_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_norm_groups"
    ADD CONSTRAINT "assessment_norm_groups_norm_set_id_fkey"
    FOREIGN KEY ("norm_set_id")
    REFERENCES "assessment_norm_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_construct_norm_tables"
    ADD CONSTRAINT "assessment_construct_norm_tables_norm_group_id_fkey"
    FOREIGN KEY ("norm_group_id")
    REFERENCES "assessment_norm_groups"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_construct_norm_tables"
    ADD CONSTRAINT "assessment_construct_norm_tables_assessment_construct_id_fkey"
    FOREIGN KEY ("assessment_construct_id")
    REFERENCES "assessment_constructs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_norm_lookup_rows"
    ADD CONSTRAINT "assessment_norm_lookup_rows_construct_norm_table_id_fkey"
    FOREIGN KEY ("construct_norm_table_id")
    REFERENCES "assessment_construct_norm_tables"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Norm version must match the immutable assessment normVersion.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_norm_set_version"()
RETURNS TRIGGER AS $$
DECLARE
    expected_norm_version VARCHAR(60);
BEGIN
    SELECT "norm_version"
      INTO expected_norm_version
      FROM "assessment_versions"
     WHERE "id" = NEW."assessment_version_id";

    IF expected_norm_version IS NULL
       OR NEW."norm_version" IS DISTINCT FROM expected_norm_version THEN
        RAISE EXCEPTION
          'Norm set version must match the assessment version norm identifier';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_norm_set_version_guard"
BEFORE INSERT OR UPDATE OF "assessment_version_id", "norm_version"
ON "assessment_norm_sets"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_norm_set_version"();

-- ------------------------------------------------------------
-- Construct and norm group must belong to the same
-- AssessmentVersion.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_norm_construct_scope"()
RETURNS TRIGGER AS $$
DECLARE
    norm_version_assessment_id UUID;
    construct_assessment_id UUID;
BEGIN
    SELECT ns."assessment_version_id"
      INTO norm_version_assessment_id
      FROM "assessment_norm_groups" ng
      JOIN "assessment_norm_sets" ns
        ON ns."id" = ng."norm_set_id"
     WHERE ng."id" = NEW."norm_group_id";

    SELECT "assessment_version_id"
      INTO construct_assessment_id
      FROM "assessment_constructs"
     WHERE "id" = NEW."assessment_construct_id";

    IF norm_version_assessment_id IS NULL
       OR construct_assessment_id IS NULL
       OR norm_version_assessment_id
          IS DISTINCT FROM construct_assessment_id THEN
        RAISE EXCEPTION
          'Norm construct must belong to the same assessment version as the norm set';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_norm_construct_scope_guard"
BEFORE INSERT OR UPDATE
ON "assessment_construct_norm_tables"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_norm_construct_scope"();

-- ------------------------------------------------------------
-- Published and retired norm content is immutable.
-- DRAFT norm content may be edited.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_published_assessment_norm_content"()
RETURNS TRIGGER AS $$
DECLARE
    norm_status "AssessmentNormSetStatus";
    target_norm_set_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'assessment_norm_sets' THEN
        target_norm_set_id := COALESCE(NEW."id", OLD."id");

    ELSIF TG_TABLE_NAME = 'assessment_norm_groups' THEN
        target_norm_set_id :=
            COALESCE(NEW."norm_set_id", OLD."norm_set_id");

    ELSIF TG_TABLE_NAME = 'assessment_construct_norm_tables' THEN
        SELECT "norm_set_id"
          INTO target_norm_set_id
          FROM "assessment_norm_groups"
         WHERE "id" =
            COALESCE(NEW."norm_group_id", OLD."norm_group_id");

    ELSIF TG_TABLE_NAME = 'assessment_norm_lookup_rows' THEN
        SELECT ng."norm_set_id"
          INTO target_norm_set_id
          FROM "assessment_construct_norm_tables" cnt
          JOIN "assessment_norm_groups" ng
            ON ng."id" = cnt."norm_group_id"
         WHERE cnt."id" =
            COALESCE(
                NEW."construct_norm_table_id",
                OLD."construct_norm_table_id"
            );
    END IF;

    SELECT "status"
      INTO norm_status
      FROM "assessment_norm_sets"
     WHERE "id" = target_norm_set_id;

    IF TG_TABLE_NAME = 'assessment_norm_sets' THEN
        IF TG_OP = 'DELETE' AND OLD."status" <> 'DRAFT' THEN
            RAISE EXCEPTION
              'Published or retired norm sets cannot be deleted';
        END IF;

        IF TG_OP = 'UPDATE' THEN
            IF OLD."status" = 'RETIRED' THEN
                RAISE EXCEPTION
                  'Retired norm sets are immutable';
            END IF;

            IF OLD."status" = 'PUBLISHED' THEN
                IF NEW."status" <> 'RETIRED' THEN
                    RAISE EXCEPTION
                      'Published norm sets may only transition to retired';
                END IF;

                IF NEW."assessment_version_id"
                     IS DISTINCT FROM OLD."assessment_version_id"
                   OR NEW."norm_version"
                     IS DISTINCT FROM OLD."norm_version"
                   OR NEW."name"
                     IS DISTINCT FROM OLD."name"
                   OR NEW."description"
                     IS DISTINCT FROM OLD."description"
                   OR NEW."source_reference"
                     IS DISTINCT FROM OLD."source_reference"
                   OR NEW."population_metadata"
                     IS DISTINCT FROM OLD."population_metadata"
                   OR NEW."published_at"
                     IS DISTINCT FROM OLD."published_at"
                   OR NEW."created_at"
                     IS DISTINCT FROM OLD."created_at" THEN
                    RAISE EXCEPTION
                      'Published norm set content is immutable';
                END IF;
            END IF;
        END IF;

        RETURN CASE
            WHEN TG_OP = 'DELETE' THEN OLD
            ELSE NEW
        END;
    END IF;

    IF norm_status IS DISTINCT FROM 'DRAFT'::"AssessmentNormSetStatus" THEN
        RAISE EXCEPTION
          'Published or retired norm content is immutable';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_norm_sets_content_guard"
BEFORE UPDATE OR DELETE
ON "assessment_norm_sets"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_norm_content"();

CREATE TRIGGER "assessment_norm_groups_content_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "assessment_norm_groups"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_norm_content"();

CREATE TRIGGER "assessment_construct_norm_tables_content_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "assessment_construct_norm_tables"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_norm_content"();

CREATE TRIGGER "assessment_norm_lookup_rows_content_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "assessment_norm_lookup_rows"
FOR EACH ROW EXECUTE FUNCTION "protect_published_assessment_norm_content"();
