-- Phase 5A: counsellor report review/release gate and private counsellor notes.
-- Candidates may only see report-data content once a release reaches RELEASED (D-007, D-010).
-- No report rendering, PDF, or web/PDF layout is introduced here.

CREATE TYPE "AssessmentReportReleaseStatus" AS ENUM (
    'PENDING_REVIEW',
    'RELEASED',
    'WITHDRAWN'
);

CREATE TABLE "assessment_report_releases" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "report_data_snapshot_id" UUID NOT NULL,
    "status" "AssessmentReportReleaseStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_report_releases_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_report_releases_lifecycle_check"
        CHECK (
            (
                "status" = 'PENDING_REVIEW'
                AND "reviewed_by_user_id" IS NULL
                AND "reviewed_at" IS NULL
                AND "released_at" IS NULL
                AND "withdrawn_at" IS NULL
                AND "withdrawn_reason" IS NULL
            )
            OR
            (
                "status" = 'RELEASED'
                AND "reviewed_by_user_id" IS NOT NULL
                AND "reviewed_at" IS NOT NULL
                AND "released_at" IS NOT NULL
                AND "withdrawn_at" IS NULL
                AND "withdrawn_reason" IS NULL
            )
            OR
            (
                "status" = 'WITHDRAWN'
                AND "reviewed_by_user_id" IS NOT NULL
                AND "reviewed_at" IS NOT NULL
                AND "released_at" IS NOT NULL
                AND "withdrawn_at" IS NOT NULL
                AND "withdrawn_reason" IS NOT NULL
            )
        )
);

CREATE TABLE "assessment_counsellor_notes" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_counsellor_notes_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "assessment_counsellor_notes_body_check"
        CHECK (length(btrim("body")) > 0)
);

CREATE UNIQUE INDEX
    "assessment_report_releases_attempt_id_key"
ON "assessment_report_releases"("attempt_id");

CREATE INDEX
    "assessment_report_releases_organization_id_status_idx"
ON "assessment_report_releases"(
    "organization_id",
    "status"
);

CREATE INDEX
    "assessment_report_releases_report_data_snapshot_id_idx"
ON "assessment_report_releases"("report_data_snapshot_id");

CREATE INDEX
    "assessment_counsellor_notes_attempt_id_created_at_idx"
ON "assessment_counsellor_notes"(
    "attempt_id",
    "created_at"
);

CREATE INDEX
    "assessment_counsellor_notes_organization_id_idx"
ON "assessment_counsellor_notes"("organization_id");

ALTER TABLE "assessment_report_releases"
    ADD CONSTRAINT
        "assessment_report_releases_attempt_id_fkey"
    FOREIGN KEY ("attempt_id")
    REFERENCES "assessment_attempts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_releases"
    ADD CONSTRAINT
        "assessment_report_releases_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_releases"
    ADD CONSTRAINT
        "assessment_report_releases_report_data_snapshot_id_fkey"
    FOREIGN KEY ("report_data_snapshot_id")
    REFERENCES "assessment_report_data_snapshots"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_releases"
    ADD CONSTRAINT
        "assessment_report_releases_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_counsellor_notes"
    ADD CONSTRAINT
        "assessment_counsellor_notes_attempt_id_fkey"
    FOREIGN KEY ("attempt_id")
    REFERENCES "assessment_attempts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_counsellor_notes"
    ADD CONSTRAINT
        "assessment_counsellor_notes_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_counsellor_notes"
    ADD CONSTRAINT
        "assessment_counsellor_notes_author_user_id_fkey"
    FOREIGN KEY ("author_user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- A release must reference the snapshot that belongs to its own
-- attempt, and organization_id must match the attempt's tenant.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_report_release_scope"()
RETURNS TRIGGER AS $$
DECLARE
    attempt_org UUID;
    snapshot_attempt UUID;
BEGIN
    SELECT aa."organization_id"
      INTO attempt_org
      FROM "assessment_attempts" a
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
     WHERE a."id" = NEW."attempt_id";

    IF attempt_org IS NULL
       OR attempt_org IS DISTINCT FROM NEW."organization_id" THEN
        RAISE EXCEPTION
          'Report release organization must match the attempt tenant';
    END IF;

    SELECT a."id"
      INTO snapshot_attempt
      FROM "assessment_report_data_snapshots" s
      JOIN "assessment_scoring_runs" sr
        ON sr."id" = s."scoring_run_id"
      JOIN "assessment_attempts" a
        ON a."id" = sr."attempt_id"
     WHERE s."id" = NEW."report_data_snapshot_id";

    IF snapshot_attempt IS NULL
       OR snapshot_attempt IS DISTINCT FROM NEW."attempt_id" THEN
        RAISE EXCEPTION
          'Report release snapshot must belong to the same attempt';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_report_release_scope_guard"
BEFORE INSERT
ON "assessment_report_releases"
FOR EACH ROW EXECUTE FUNCTION
    "validate_assessment_report_release_scope"();

-- ------------------------------------------------------------
-- Identity fields are immutable, and status may only move
-- PENDING_REVIEW -> RELEASED -> WITHDRAWN (or stay unchanged).
-- ------------------------------------------------------------

CREATE FUNCTION "guard_assessment_report_release_transition"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."attempt_id" IS DISTINCT FROM OLD."attempt_id"
       OR NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
       OR NEW."report_data_snapshot_id"
          IS DISTINCT FROM OLD."report_data_snapshot_id"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
        RAISE EXCEPTION
          'Report release identity fields are immutable';
    END IF;

    IF NEW."status" = OLD."status" THEN
        RETURN NEW;
    END IF;

    IF OLD."status" = 'PENDING_REVIEW'
       AND NEW."status" = 'RELEASED' THEN
        RETURN NEW;
    END IF;

    IF OLD."status" = 'RELEASED'
       AND NEW."status" = 'WITHDRAWN' THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Report release status may only move PENDING_REVIEW -> RELEASED -> WITHDRAWN';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_report_release_transition_guard"
BEFORE UPDATE
ON "assessment_report_releases"
FOR EACH ROW EXECUTE FUNCTION
    "guard_assessment_report_release_transition"();

-- ------------------------------------------------------------
-- Counsellor note scope guard: identity fields are immutable and
-- organization_id must match the attempt tenant.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_counsellor_note_scope"()
RETURNS TRIGGER AS $$
DECLARE
    attempt_org UUID;
BEGIN
    SELECT aa."organization_id"
      INTO attempt_org
      FROM "assessment_attempts" a
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
     WHERE a."id" = NEW."attempt_id";

    IF attempt_org IS NULL
       OR attempt_org IS DISTINCT FROM NEW."organization_id" THEN
        RAISE EXCEPTION
          'Counsellor note organization must match the attempt tenant';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_counsellor_note_scope_guard"
BEFORE INSERT
ON "assessment_counsellor_notes"
FOR EACH ROW EXECUTE FUNCTION
    "validate_assessment_counsellor_note_scope"();

CREATE FUNCTION "guard_assessment_counsellor_note_identity"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."attempt_id" IS DISTINCT FROM OLD."attempt_id"
       OR NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
       OR NEW."author_user_id" IS DISTINCT FROM OLD."author_user_id"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
        RAISE EXCEPTION
          'Counsellor note identity fields are immutable';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_counsellor_note_identity_guard"
BEFORE UPDATE
ON "assessment_counsellor_notes"
FOR EACH ROW EXECUTE FUNCTION
    "guard_assessment_counsellor_note_identity"();
