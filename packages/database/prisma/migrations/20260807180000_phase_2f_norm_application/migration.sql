-- Phase 2F: immutable norm application results and provenance.
-- This migration does not create or infer normative values.

CREATE TABLE "assessment_norm_applications" (
    "id" UUID NOT NULL,
    "scoring_run_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "norm_set_id" UUID NOT NULL,
    "norm_group_id" UUID NOT NULL,
    "construct_norm_table_id" UUID NOT NULL,
    "norm_lookup_row_id" UUID NOT NULL,
    "raw_score" DECIMAL(20,8) NOT NULL,
    "standardized_score" DECIMAL(20,8),
    "percentile" DECIMAL(8,4),
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "assessment_norm_applications_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_norm_applications_percentile_check"
        CHECK (
            "percentile" IS NULL
            OR (
                "percentile" >= 0
                AND "percentile" <= 100
            )
        )
);

CREATE UNIQUE INDEX
    "assessment_norm_applications_scoring_run_id_assessment_construct_id_norm_group_id_key"
ON "assessment_norm_applications"(
    "scoring_run_id",
    "assessment_construct_id",
    "norm_group_id"
);

CREATE INDEX "assessment_norm_applications_norm_set_id_idx"
    ON "assessment_norm_applications"("norm_set_id");

CREATE INDEX "assessment_norm_applications_norm_group_id_idx"
    ON "assessment_norm_applications"("norm_group_id");

CREATE INDEX "assessment_norm_applications_construct_norm_table_id_idx"
    ON "assessment_norm_applications"("construct_norm_table_id");

CREATE INDEX "assessment_norm_applications_norm_lookup_row_id_idx"
    ON "assessment_norm_applications"("norm_lookup_row_id");

CREATE INDEX "assessment_norm_applications_applied_at_idx"
    ON "assessment_norm_applications"("applied_at");

ALTER TABLE "assessment_norm_applications"
    ADD CONSTRAINT "assessment_norm_applications_construct_score_fkey"
    FOREIGN KEY (
        "scoring_run_id",
        "assessment_construct_id"
    )
    REFERENCES "assessment_construct_scores"(
        "scoring_run_id",
        "assessment_construct_id"
    )
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_norm_applications"
    ADD CONSTRAINT "assessment_norm_applications_norm_set_id_fkey"
    FOREIGN KEY ("norm_set_id")
    REFERENCES "assessment_norm_sets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_norm_applications"
    ADD CONSTRAINT "assessment_norm_applications_norm_group_id_fkey"
    FOREIGN KEY ("norm_group_id")
    REFERENCES "assessment_norm_groups"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_norm_applications"
    ADD CONSTRAINT "assessment_norm_applications_construct_norm_table_id_fkey"
    FOREIGN KEY ("construct_norm_table_id")
    REFERENCES "assessment_construct_norm_tables"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_norm_applications"
    ADD CONSTRAINT "assessment_norm_applications_norm_lookup_row_id_fkey"
    FOREIGN KEY ("norm_lookup_row_id")
    REFERENCES "assessment_norm_lookup_rows"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Validate the complete normalization provenance chain.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_norm_application"()
RETURNS TRIGGER AS $$
DECLARE
    stored_raw_score DECIMAL(20,8);
    expected_construct UUID;

    set_status "AssessmentNormSetStatus";
    set_version_id UUID;

    group_set_id UUID;

    table_group_id UUID;
    table_construct_id UUID;

    lookup_table_id UUID;
    lookup_min DECIMAL(20,8);
    lookup_max DECIMAL(20,8);
    lookup_standardized DECIMAL(20,8);
    lookup_percentile DECIMAL(8,4);

    scoring_assessment_version UUID;
BEGIN
    -- Raw score provenance.
    SELECT
        cs."raw_score",
        cs."assessment_construct_id",
        aa."assessment_version_id"
      INTO
        stored_raw_score,
        expected_construct,
        scoring_assessment_version
      FROM "assessment_construct_scores" cs
      JOIN "assessment_scoring_runs" sr
        ON sr."id" = cs."scoring_run_id"
      JOIN "assessment_attempts" a
        ON a."id" = sr."attempt_id"
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
     WHERE cs."scoring_run_id" = NEW."scoring_run_id"
       AND cs."assessment_construct_id" =
           NEW."assessment_construct_id";

    IF stored_raw_score IS NULL THEN
        RAISE EXCEPTION
          'Norm application requires an existing raw construct score';
    END IF;

    IF NEW."raw_score" IS DISTINCT FROM stored_raw_score THEN
        RAISE EXCEPTION
          'Norm application raw score must match the stored construct raw score';
    END IF;

    -- Norm set must be published and belong to the scored assessment.
    SELECT
        "status",
        "assessment_version_id"
      INTO
        set_status,
        set_version_id
      FROM "assessment_norm_sets"
     WHERE "id" = NEW."norm_set_id";

    IF set_status IS DISTINCT FROM
       'PUBLISHED'::"AssessmentNormSetStatus" THEN
        RAISE EXCEPTION
          'Only published norm sets may be applied';
    END IF;

    IF set_version_id IS DISTINCT FROM scoring_assessment_version THEN
        RAISE EXCEPTION
          'Norm set must belong to the scored assessment version';
    END IF;

    -- Norm group must belong to the selected set.
    SELECT "norm_set_id"
      INTO group_set_id
      FROM "assessment_norm_groups"
     WHERE "id" = NEW."norm_group_id";

    IF group_set_id IS DISTINCT FROM NEW."norm_set_id" THEN
        RAISE EXCEPTION
          'Norm group must belong to the selected norm set';
    END IF;

    -- Construct table must belong to selected group and construct.
    SELECT
        "norm_group_id",
        "assessment_construct_id"
      INTO
        table_group_id,
        table_construct_id
      FROM "assessment_construct_norm_tables"
     WHERE "id" = NEW."construct_norm_table_id";

    IF table_group_id IS DISTINCT FROM NEW."norm_group_id"
       OR table_construct_id IS DISTINCT FROM
          NEW."assessment_construct_id" THEN
        RAISE EXCEPTION
          'Norm table must match the selected group and construct';
    END IF;

    -- Lookup row must belong to the table and contain the raw score.
    SELECT
        "construct_norm_table_id",
        "raw_score_min",
        "raw_score_max",
        "standardized_score",
        "percentile"
      INTO
        lookup_table_id,
        lookup_min,
        lookup_max,
        lookup_standardized,
        lookup_percentile
      FROM "assessment_norm_lookup_rows"
     WHERE "id" = NEW."norm_lookup_row_id";

    IF lookup_table_id IS DISTINCT FROM
       NEW."construct_norm_table_id" THEN
        RAISE EXCEPTION
          'Norm lookup row must belong to the selected construct norm table';
    END IF;

    IF NEW."raw_score" < lookup_min
       OR NEW."raw_score" > lookup_max THEN
        RAISE EXCEPTION
          'Raw score is outside the selected norm lookup interval';
    END IF;

    -- Persisted outputs must exactly match the validated lookup row.
    IF NEW."standardized_score"
       IS DISTINCT FROM lookup_standardized THEN
        RAISE EXCEPTION
          'Standardized score must match the selected norm lookup row';
    END IF;

    IF NEW."percentile"
       IS DISTINCT FROM lookup_percentile THEN
        RAISE EXCEPTION
          'Percentile must match the selected norm lookup row';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_norm_application_validation_guard"
BEFORE INSERT
ON "assessment_norm_applications"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_norm_application"();

-- ------------------------------------------------------------
-- Norm application provenance is append-only and immutable.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_assessment_norm_application_history"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
      'Assessment norm application history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_norm_application_history_guard"
BEFORE UPDATE OR DELETE
ON "assessment_norm_applications"
FOR EACH ROW EXECUTE FUNCTION "protect_assessment_norm_application_history"();
