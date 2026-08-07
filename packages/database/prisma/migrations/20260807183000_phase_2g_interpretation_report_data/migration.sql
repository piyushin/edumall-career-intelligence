-- Phase 2G: versioned interpretation and report-data provenance.
-- No interpretation rules, labels, recommendations, cutoffs, or report content are seeded.

CREATE TYPE "AssessmentInterpretationSetStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'RETIRED'
);

CREATE TYPE "AssessmentInterpretationMetric" AS ENUM (
    'RAW_SCORE',
    'STANDARDIZED_SCORE',
    'PERCENTILE'
);

CREATE TABLE "assessment_interpretation_sets" (
    "id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "version" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "source_reference" TEXT,
    "methodology" JSONB,
    "status" "AssessmentInterpretationSetStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_interpretation_sets_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_interpretation_sets_lifecycle_check"
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

CREATE TABLE "assessment_interpretation_rules" (
    "id" UUID NOT NULL,
    "interpretation_set_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "metric" "AssessmentInterpretationMetric" NOT NULL,
    "lower_bound" DECIMAL(20,8),
    "upper_bound" DECIMAL(20,8),
    "lower_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "upper_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "output_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_interpretation_rules_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_interpretation_rules_bounds_check"
        CHECK (
            "lower_bound" IS NULL
            OR "upper_bound" IS NULL
            OR "lower_bound" <= "upper_bound"
        )
);

CREATE TABLE "assessment_interpretation_applications" (
    "id" UUID NOT NULL,
    "norm_application_id" UUID NOT NULL,
    "interpretation_rule_id" UUID NOT NULL,
    "metric_value" DECIMAL(20,8) NOT NULL,
    "output_data" JSONB,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "assessment_interpretation_applications_pkey"
        PRIMARY KEY ("id")
);

CREATE TABLE "assessment_report_data_snapshots" (
    "id" UUID NOT NULL,
    "scoring_run_id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "interpretation_set_id" UUID,
    "report_version" VARCHAR(60) NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "assessment_report_data_snapshots_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_report_data_snapshots_input_hash_check"
        CHECK ("input_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX
    "assessment_interpretation_sets_assessment_version_id_version_key"
ON "assessment_interpretation_sets"(
    "assessment_version_id",
    "version"
);

CREATE INDEX
    "assessment_interpretation_sets_assessment_version_id_status_idx"
ON "assessment_interpretation_sets"(
    "assessment_version_id",
    "status"
);

CREATE INDEX
    "assessment_interpretation_sets_status_published_at_idx"
ON "assessment_interpretation_sets"(
    "status",
    "published_at"
);

CREATE UNIQUE INDEX
    "assessment_interpretation_rules_interpretation_set_id_code_key"
ON "assessment_interpretation_rules"(
    "interpretation_set_id",
    "code"
);

CREATE INDEX
    "assessment_interpretation_rules_interpretation_set_id_assessment_construct_id_idx"
ON "assessment_interpretation_rules"(
    "interpretation_set_id",
    "assessment_construct_id"
);

CREATE INDEX
    "assessment_interpretation_rules_assessment_construct_id_metric_idx"
ON "assessment_interpretation_rules"(
    "assessment_construct_id",
    "metric"
);

CREATE UNIQUE INDEX
    "assessment_interpretation_applications_norm_application_id_interpretation_rule_id_key"
ON "assessment_interpretation_applications"(
    "norm_application_id",
    "interpretation_rule_id"
);

CREATE INDEX
    "assessment_interpretation_applications_interpretation_rule_id_idx"
ON "assessment_interpretation_applications"(
    "interpretation_rule_id"
);

CREATE INDEX
    "assessment_interpretation_applications_applied_at_idx"
ON "assessment_interpretation_applications"(
    "applied_at"
);

CREATE UNIQUE INDEX
    "assessment_report_data_snapshots_scoring_run_id_report_version_input_hash_key"
ON "assessment_report_data_snapshots"(
    "scoring_run_id",
    "report_version",
    "input_hash"
);

CREATE INDEX
    "assessment_report_data_snapshots_assessment_version_id_report_version_idx"
ON "assessment_report_data_snapshots"(
    "assessment_version_id",
    "report_version"
);

CREATE INDEX
    "assessment_report_data_snapshots_interpretation_set_id_idx"
ON "assessment_report_data_snapshots"(
    "interpretation_set_id"
);

CREATE INDEX
    "assessment_report_data_snapshots_generated_at_idx"
ON "assessment_report_data_snapshots"(
    "generated_at"
);

ALTER TABLE "assessment_interpretation_sets"
    ADD CONSTRAINT
        "assessment_interpretation_sets_assessment_version_id_fkey"
    FOREIGN KEY ("assessment_version_id")
    REFERENCES "assessment_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_interpretation_rules"
    ADD CONSTRAINT
        "assessment_interpretation_rules_interpretation_set_id_fkey"
    FOREIGN KEY ("interpretation_set_id")
    REFERENCES "assessment_interpretation_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_interpretation_rules"
    ADD CONSTRAINT
        "assessment_interpretation_rules_assessment_construct_id_fkey"
    FOREIGN KEY ("assessment_construct_id")
    REFERENCES "assessment_constructs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_interpretation_applications"
    ADD CONSTRAINT
        "assessment_interpretation_applications_norm_application_id_fkey"
    FOREIGN KEY ("norm_application_id")
    REFERENCES "assessment_norm_applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_interpretation_applications"
    ADD CONSTRAINT
        "assessment_interpretation_applications_interpretation_rule_id_fkey"
    FOREIGN KEY ("interpretation_rule_id")
    REFERENCES "assessment_interpretation_rules"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_data_snapshots"
    ADD CONSTRAINT
        "assessment_report_data_snapshots_scoring_run_id_fkey"
    FOREIGN KEY ("scoring_run_id")
    REFERENCES "assessment_scoring_runs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_data_snapshots"
    ADD CONSTRAINT
        "assessment_report_data_snapshots_assessment_version_id_fkey"
    FOREIGN KEY ("assessment_version_id")
    REFERENCES "assessment_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_data_snapshots"
    ADD CONSTRAINT
        "assessment_report_data_snapshots_interpretation_set_id_fkey"
    FOREIGN KEY ("interpretation_set_id")
    REFERENCES "assessment_interpretation_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Interpretation rule must remain inside the same assessment.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_interpretation_rule_scope"()
RETURNS TRIGGER AS $$
DECLARE
    set_version UUID;
    construct_version UUID;
BEGIN
    SELECT "assessment_version_id"
      INTO set_version
      FROM "assessment_interpretation_sets"
     WHERE "id" = NEW."interpretation_set_id";

    SELECT "assessment_version_id"
      INTO construct_version
      FROM "assessment_constructs"
     WHERE "id" = NEW."assessment_construct_id";

    IF set_version IS NULL
       OR construct_version IS NULL
       OR set_version IS DISTINCT FROM construct_version THEN
        RAISE EXCEPTION
          'Interpretation rule construct must belong to the interpretation assessment version';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_interpretation_rule_scope_guard"
BEFORE INSERT OR UPDATE
ON "assessment_interpretation_rules"
FOR EACH ROW EXECUTE FUNCTION
    "validate_assessment_interpretation_rule_scope"();

-- ------------------------------------------------------------
-- Interpretation application validation.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_interpretation_application"()
RETURNS TRIGGER AS $$
DECLARE
    rule_metric "AssessmentInterpretationMetric";
    rule_lower DECIMAL(20,8);
    rule_upper DECIMAL(20,8);
    rule_lower_inclusive BOOLEAN;
    rule_upper_inclusive BOOLEAN;
    rule_output JSONB;
    rule_construct UUID;
    rule_set_status "AssessmentInterpretationSetStatus";
    rule_assessment_version UUID;

    norm_construct UUID;
    norm_raw DECIMAL(20,8);
    norm_standardized DECIMAL(20,8);
    norm_percentile DECIMAL(8,4);
    norm_assessment_version UUID;

    expected_metric DECIMAL(20,8);
BEGIN
    SELECT
        r."metric",
        r."lower_bound",
        r."upper_bound",
        r."lower_inclusive",
        r."upper_inclusive",
        r."output_data",
        r."assessment_construct_id",
        s."status",
        s."assessment_version_id"
      INTO
        rule_metric,
        rule_lower,
        rule_upper,
        rule_lower_inclusive,
        rule_upper_inclusive,
        rule_output,
        rule_construct,
        rule_set_status,
        rule_assessment_version
      FROM "assessment_interpretation_rules" r
      JOIN "assessment_interpretation_sets" s
        ON s."id" = r."interpretation_set_id"
     WHERE r."id" = NEW."interpretation_rule_id";

    IF rule_set_status IS DISTINCT FROM
       'PUBLISHED'::"AssessmentInterpretationSetStatus" THEN
        RAISE EXCEPTION
          'Only published interpretation sets may be applied';
    END IF;

    SELECT
        na."assessment_construct_id",
        na."raw_score",
        na."standardized_score",
        na."percentile",
        ns."assessment_version_id"
      INTO
        norm_construct,
        norm_raw,
        norm_standardized,
        norm_percentile,
        norm_assessment_version
      FROM "assessment_norm_applications" na
      JOIN "assessment_norm_sets" ns
        ON ns."id" = na."norm_set_id"
     WHERE na."id" = NEW."norm_application_id";

    IF rule_construct IS DISTINCT FROM norm_construct THEN
        RAISE EXCEPTION
          'Interpretation rule must match the normalized construct';
    END IF;

    IF rule_assessment_version
       IS DISTINCT FROM norm_assessment_version THEN
        RAISE EXCEPTION
          'Interpretation set must match the normalized assessment version';
    END IF;

    IF rule_metric = 'RAW_SCORE'::"AssessmentInterpretationMetric" THEN
        expected_metric := norm_raw;

    ELSIF rule_metric =
          'STANDARDIZED_SCORE'::"AssessmentInterpretationMetric" THEN
        expected_metric := norm_standardized;

    ELSE
        expected_metric := norm_percentile;
    END IF;

    IF expected_metric IS NULL THEN
        RAISE EXCEPTION
          'Interpretation metric is unavailable for this norm result';
    END IF;

    IF NEW."metric_value" IS DISTINCT FROM expected_metric THEN
        RAISE EXCEPTION
          'Interpretation metric value must match the normalized result';
    END IF;

    IF rule_lower IS NOT NULL THEN
        IF rule_lower_inclusive
           AND NEW."metric_value" < rule_lower THEN
            RAISE EXCEPTION
              'Interpretation metric is outside the rule range';
        END IF;

        IF NOT rule_lower_inclusive
           AND NEW."metric_value" <= rule_lower THEN
            RAISE EXCEPTION
              'Interpretation metric is outside the rule range';
        END IF;
    END IF;

    IF rule_upper IS NOT NULL THEN
        IF rule_upper_inclusive
           AND NEW."metric_value" > rule_upper THEN
            RAISE EXCEPTION
              'Interpretation metric is outside the rule range';
        END IF;

        IF NOT rule_upper_inclusive
           AND NEW."metric_value" >= rule_upper THEN
            RAISE EXCEPTION
              'Interpretation metric is outside the rule range';
        END IF;
    END IF;

    IF NEW."output_data" IS DISTINCT FROM rule_output THEN
        RAISE EXCEPTION
          'Interpretation output must match the published interpretation rule';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_interpretation_application_validation_guard"
BEFORE INSERT
ON "assessment_interpretation_applications"
FOR EACH ROW EXECUTE FUNCTION
    "validate_assessment_interpretation_application"();

-- ------------------------------------------------------------
-- Report-data snapshot validation.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_report_data_snapshot"()
RETURNS TRIGGER AS $$
DECLARE
    scoring_version_id UUID;
    expected_report_version VARCHAR(60);
    interpretation_version_id UUID;
    interpretation_status "AssessmentInterpretationSetStatus";
BEGIN
    SELECT
        aa."assessment_version_id",
        av."report_version"
      INTO
        scoring_version_id,
        expected_report_version
      FROM "assessment_scoring_runs" sr
      JOIN "assessment_attempts" a
        ON a."id" = sr."attempt_id"
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
      JOIN "assessment_versions" av
        ON av."id" = aa."assessment_version_id"
     WHERE sr."id" = NEW."scoring_run_id";

    IF scoring_version_id IS NULL
       OR NEW."assessment_version_id"
          IS DISTINCT FROM scoring_version_id THEN
        RAISE EXCEPTION
          'Report data assessment version must match the scoring run';
    END IF;

    IF NEW."report_version"
       IS DISTINCT FROM expected_report_version THEN
        RAISE EXCEPTION
          'Report data version must match the assessment report identifier';
    END IF;

    IF NEW."interpretation_set_id" IS NOT NULL THEN
        SELECT
            "assessment_version_id",
            "status"
          INTO
            interpretation_version_id,
            interpretation_status
          FROM "assessment_interpretation_sets"
         WHERE "id" = NEW."interpretation_set_id";

        IF interpretation_version_id
           IS DISTINCT FROM scoring_version_id THEN
            RAISE EXCEPTION
              'Report interpretation set must belong to the scored assessment version';
        END IF;

        IF interpretation_status IS DISTINCT FROM
           'PUBLISHED'::"AssessmentInterpretationSetStatus" THEN
            RAISE EXCEPTION
              'Report data may only reference a published interpretation set';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_report_data_snapshot_validation_guard"
BEFORE INSERT
ON "assessment_report_data_snapshots"
FOR EACH ROW EXECUTE FUNCTION
    "validate_assessment_report_data_snapshot"();

-- ------------------------------------------------------------
-- Published interpretation content is immutable.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_published_assessment_interpretation_content"()
RETURNS TRIGGER AS $$
DECLARE
    set_status "AssessmentInterpretationSetStatus";
    target_set_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'assessment_interpretation_sets' THEN
        target_set_id := COALESCE(NEW."id", OLD."id");
    ELSE
        target_set_id :=
            COALESCE(
                NEW."interpretation_set_id",
                OLD."interpretation_set_id"
            );
    END IF;

    SELECT "status"
      INTO set_status
      FROM "assessment_interpretation_sets"
     WHERE "id" = target_set_id;

    IF TG_TABLE_NAME = 'assessment_interpretation_sets' THEN
        IF TG_OP = 'DELETE'
           AND OLD."status" <> 'DRAFT' THEN
            RAISE EXCEPTION
              'Published or retired interpretation sets cannot be deleted';
        END IF;

        IF TG_OP = 'UPDATE' THEN
            IF OLD."status" = 'RETIRED' THEN
                RAISE EXCEPTION
                  'Retired interpretation sets are immutable';
            END IF;

            IF OLD."status" = 'PUBLISHED' THEN
                IF NEW."status" <> 'RETIRED' THEN
                    RAISE EXCEPTION
                      'Published interpretation sets may only transition to retired';
                END IF;

                IF NEW."assessment_version_id"
                     IS DISTINCT FROM OLD."assessment_version_id"
                   OR NEW."version"
                     IS DISTINCT FROM OLD."version"
                   OR NEW."name"
                     IS DISTINCT FROM OLD."name"
                   OR NEW."description"
                     IS DISTINCT FROM OLD."description"
                   OR NEW."source_reference"
                     IS DISTINCT FROM OLD."source_reference"
                   OR NEW."methodology"
                     IS DISTINCT FROM OLD."methodology"
                   OR NEW."published_at"
                     IS DISTINCT FROM OLD."published_at"
                   OR NEW."created_at"
                     IS DISTINCT FROM OLD."created_at" THEN
                    RAISE EXCEPTION
                      'Published interpretation set content is immutable';
                END IF;
            END IF;
        END IF;

        RETURN CASE
            WHEN TG_OP = 'DELETE' THEN OLD
            ELSE NEW
        END;
    END IF;

    IF set_status IS DISTINCT FROM
       'DRAFT'::"AssessmentInterpretationSetStatus" THEN
        RAISE EXCEPTION
          'Published or retired interpretation rules are immutable';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_interpretation_sets_content_guard"
BEFORE UPDATE OR DELETE
ON "assessment_interpretation_sets"
FOR EACH ROW EXECUTE FUNCTION
    "protect_published_assessment_interpretation_content"();

CREATE TRIGGER "assessment_interpretation_rules_content_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "assessment_interpretation_rules"
FOR EACH ROW EXECUTE FUNCTION
    "protect_published_assessment_interpretation_content"();

-- ------------------------------------------------------------
-- Applications and report snapshots are append-only.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_assessment_interpretation_output_history"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
      'Assessment interpretation and report-data history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_interpretation_applications_history_guard"
BEFORE UPDATE OR DELETE
ON "assessment_interpretation_applications"
FOR EACH ROW EXECUTE FUNCTION
    "protect_assessment_interpretation_output_history"();

CREATE TRIGGER "assessment_report_data_snapshots_history_guard"
BEFORE UPDATE OR DELETE
ON "assessment_report_data_snapshots"
FOR EACH ROW EXECUTE FUNCTION
    "protect_assessment_interpretation_output_history"();
