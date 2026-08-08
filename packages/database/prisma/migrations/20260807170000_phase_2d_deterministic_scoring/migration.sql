-- Phase 2D: deterministic raw scoring persistence and provenance.

CREATE TABLE "assessment_scoring_runs" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "scoring_version" VARCHAR(60) NOT NULL,
    "algorithm_version" VARCHAR(60) NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "assessment_scoring_runs_pkey"
        PRIMARY KEY ("id"),
    CONSTRAINT "assessment_scoring_runs_input_hash_check"
        CHECK ("input_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "assessment_construct_scores" (
    "scoring_run_id" UUID NOT NULL,
    "assessment_construct_id" UUID NOT NULL,
    "raw_score" DECIMAL(20,8) NOT NULL,
    "answered_item_count" INTEGER NOT NULL,
    "contribution_count" INTEGER NOT NULL,

    CONSTRAINT "assessment_construct_scores_pkey"
        PRIMARY KEY (
            "scoring_run_id",
            "assessment_construct_id"
        ),
    CONSTRAINT "assessment_construct_scores_answered_count_check"
        CHECK ("answered_item_count" >= 0),
    CONSTRAINT "assessment_construct_scores_contribution_count_check"
        CHECK ("contribution_count" >= 0)
);

CREATE UNIQUE INDEX
    "assessment_scoring_runs_attempt_id_scoring_version_algorithm_version_input_hash_key"
ON "assessment_scoring_runs"(
    "attempt_id",
    "scoring_version",
    "algorithm_version",
    "input_hash"
);

CREATE INDEX "assessment_scoring_runs_attempt_id_calculated_at_idx"
    ON "assessment_scoring_runs"("attempt_id", "calculated_at");

CREATE INDEX "assessment_scoring_runs_scoring_version_algorithm_version_idx"
    ON "assessment_scoring_runs"(
        "scoring_version",
        "algorithm_version"
    );

CREATE INDEX "assessment_construct_scores_assessment_construct_id_idx"
    ON "assessment_construct_scores"("assessment_construct_id");

ALTER TABLE "assessment_scoring_runs"
    ADD CONSTRAINT "assessment_scoring_runs_attempt_id_fkey"
    FOREIGN KEY ("attempt_id")
    REFERENCES "assessment_attempts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_construct_scores"
    ADD CONSTRAINT "assessment_construct_scores_scoring_run_id_fkey"
    FOREIGN KEY ("scoring_run_id")
    REFERENCES "assessment_scoring_runs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_construct_scores"
    ADD CONSTRAINT "assessment_construct_scores_assessment_construct_id_fkey"
    FOREIGN KEY ("assessment_construct_id")
    REFERENCES "assessment_constructs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Scoring runs are permitted only for submitted attempts and
-- must capture the scoringVersion of the assigned assessment.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_scoring_run"()
RETURNS TRIGGER AS $$
DECLARE
    attempt_status "AssessmentAttemptStatus";
    expected_scoring_version VARCHAR(60);
BEGIN
    SELECT
        a."status",
        av."scoring_version"
      INTO
        attempt_status,
        expected_scoring_version
      FROM "assessment_attempts" a
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
      JOIN "assessment_versions" av
        ON av."id" = aa."assessment_version_id"
     WHERE a."id" = NEW."attempt_id";

    IF attempt_status IS DISTINCT FROM
       'SUBMITTED'::"AssessmentAttemptStatus" THEN
        RAISE EXCEPTION
          'Only submitted assessment attempts may be scored';
    END IF;

    IF NEW."scoring_version"
       IS DISTINCT FROM expected_scoring_version THEN
        RAISE EXCEPTION
          'Scoring run version must match the assessment version scoring identifier';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_scoring_run_validation_guard"
BEFORE INSERT ON "assessment_scoring_runs"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_scoring_run"();

-- ------------------------------------------------------------
-- Construct score must belong to the same assessment version
-- as the attempt represented by its scoring run.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_construct_score_scope"()
RETURNS TRIGGER AS $$
DECLARE
    attempt_version UUID;
    construct_version UUID;
BEGIN
    SELECT aa."assessment_version_id"
      INTO attempt_version
      FROM "assessment_scoring_runs" sr
      JOIN "assessment_attempts" a
        ON a."id" = sr."attempt_id"
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
     WHERE sr."id" = NEW."scoring_run_id";

    SELECT "assessment_version_id"
      INTO construct_version
      FROM "assessment_constructs"
     WHERE "id" = NEW."assessment_construct_id";

    IF attempt_version IS NULL
       OR construct_version IS NULL
       OR attempt_version IS DISTINCT FROM construct_version THEN
        RAISE EXCEPTION
          'Construct score must belong to the scored assessment version';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_construct_score_scope_guard"
BEFORE INSERT ON "assessment_construct_scores"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_construct_score_scope"();

-- ------------------------------------------------------------
-- Scoring history is append-only and immutable.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_assessment_scoring_history"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Assessment scoring history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_scoring_runs_history_guard"
BEFORE UPDATE OR DELETE ON "assessment_scoring_runs"
FOR EACH ROW EXECUTE FUNCTION "protect_assessment_scoring_history"();

CREATE TRIGGER "assessment_construct_scores_history_guard"
BEFORE UPDATE OR DELETE ON "assessment_construct_scores"
FOR EACH ROW EXECUTE FUNCTION "protect_assessment_scoring_history"();
