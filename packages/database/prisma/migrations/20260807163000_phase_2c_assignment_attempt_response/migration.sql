-- Phase 2C: assessment assignment, attempts, and response persistence.

CREATE TYPE "AssessmentAssignmentStatus" AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'EXPIRED'
);

CREATE TYPE "AssessmentAttemptStatus" AS ENUM (
    'IN_PROGRESS',
    'SUBMITTED',
    'ABANDONED'
);

CREATE TABLE "assessment_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assessment_version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by_user_id" UUID,
    "status" "AssessmentAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "available_from" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "assessment_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_assignments_max_attempts_check"
        CHECK ("max_attempts" > 0),
    CONSTRAINT "assessment_assignments_window_check"
        CHECK (
            "available_from" IS NULL
            OR "expires_at" IS NULL
            OR "expires_at" > "available_from"
        ),
    CONSTRAINT "assessment_assignments_status_check"
        CHECK (
            ("status" = 'ACTIVE' AND "cancelled_at" IS NULL)
            OR
            ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL)
            OR
            ("status" = 'EXPIRED' AND "cancelled_at" IS NULL)
        )
);

CREATE TABLE "assessment_attempts" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "AssessmentAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "abandoned_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_attempts_attempt_number_check"
        CHECK ("attempt_number" > 0),
    CONSTRAINT "assessment_attempts_lifecycle_check"
        CHECK (
            (
                "status" = 'IN_PROGRESS'
                AND "submitted_at" IS NULL
                AND "abandoned_at" IS NULL
            )
            OR
            (
                "status" = 'SUBMITTED'
                AND "submitted_at" IS NOT NULL
                AND "abandoned_at" IS NULL
            )
            OR
            (
                "status" = 'ABANDONED'
                AND "submitted_at" IS NULL
                AND "abandoned_at" IS NOT NULL
            )
        )
);

CREATE TABLE "assessment_responses" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "text_value" TEXT,
    "numeric_value" DECIMAL(18,6),
    "boolean_value" BOOLEAN,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assessment_response_options" (
    "response_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_response_options_pkey"
        PRIMARY KEY ("response_id", "option_id")
);

CREATE INDEX "assessment_assignments_organization_id_status_idx"
    ON "assessment_assignments"("organization_id", "status");

CREATE INDEX "assessment_assignments_user_id_status_idx"
    ON "assessment_assignments"("user_id", "status");

CREATE INDEX "assessment_assignments_assessment_version_id_status_idx"
    ON "assessment_assignments"("assessment_version_id", "status");

CREATE INDEX "assessment_assignments_expires_at_idx"
    ON "assessment_assignments"("expires_at");

CREATE UNIQUE INDEX "assessment_attempts_assignment_id_attempt_number_key"
    ON "assessment_attempts"("assignment_id", "attempt_number");

CREATE INDEX "assessment_attempts_assignment_id_status_idx"
    ON "assessment_attempts"("assignment_id", "status");

CREATE INDEX "assessment_attempts_status_started_at_idx"
    ON "assessment_attempts"("status", "started_at");

CREATE UNIQUE INDEX "assessment_responses_attempt_id_item_id_key"
    ON "assessment_responses"("attempt_id", "item_id");

CREATE INDEX "assessment_responses_attempt_id_idx"
    ON "assessment_responses"("attempt_id");

CREATE INDEX "assessment_responses_item_id_idx"
    ON "assessment_responses"("item_id");

CREATE INDEX "assessment_response_options_option_id_idx"
    ON "assessment_response_options"("option_id");

ALTER TABLE "assessment_assignments"
    ADD CONSTRAINT "assessment_assignments_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_assignments"
    ADD CONSTRAINT "assessment_assignments_assessment_version_id_fkey"
    FOREIGN KEY ("assessment_version_id")
    REFERENCES "assessment_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_assignments"
    ADD CONSTRAINT "assessment_assignments_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_assignments"
    ADD CONSTRAINT "assessment_assignments_assigned_by_user_id_fkey"
    FOREIGN KEY ("assigned_by_user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_attempts"
    ADD CONSTRAINT "assessment_attempts_assignment_id_fkey"
    FOREIGN KEY ("assignment_id")
    REFERENCES "assessment_assignments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_responses"
    ADD CONSTRAINT "assessment_responses_attempt_id_fkey"
    FOREIGN KEY ("attempt_id")
    REFERENCES "assessment_attempts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_responses"
    ADD CONSTRAINT "assessment_responses_item_id_fkey"
    FOREIGN KEY ("item_id")
    REFERENCES "assessment_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_response_options"
    ADD CONSTRAINT "assessment_response_options_response_id_fkey"
    FOREIGN KEY ("response_id")
    REFERENCES "assessment_responses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_response_options"
    ADD CONSTRAINT "assessment_response_options_option_id_fkey"
    FOREIGN KEY ("option_id")
    REFERENCES "assessment_item_options"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Assignment validation
-- Only published assessment versions may be assigned.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_assignment"()
RETURNS TRIGGER AS $$
DECLARE
    version_status "AssessmentVersionStatus";
BEGIN
    SELECT "status"
      INTO version_status
      FROM "assessment_versions"
     WHERE "id" = NEW."assessment_version_id";

    IF version_status IS DISTINCT FROM 'PUBLISHED'::"AssessmentVersionStatus" THEN
        RAISE EXCEPTION 'Only published assessment versions may be assigned';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_assignment_version_guard"
BEFORE INSERT OR UPDATE OF "assessment_version_id"
ON "assessment_assignments"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_assignment"();

-- ------------------------------------------------------------
-- Attempt validation
-- Assignment must be active and within its validity period.
-- Attempt number must not exceed maxAttempts.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_attempt"()
RETURNS TRIGGER AS $$
DECLARE
    assignment_status "AssessmentAssignmentStatus";
    assignment_available_from TIMESTAMP(3);
    assignment_expires_at TIMESTAMP(3);
    assignment_max_attempts INTEGER;
BEGIN
    SELECT
        "status",
        "available_from",
        "expires_at",
        "max_attempts"
      INTO
        assignment_status,
        assignment_available_from,
        assignment_expires_at,
        assignment_max_attempts
      FROM "assessment_assignments"
     WHERE "id" = NEW."assignment_id";

    IF assignment_status IS DISTINCT FROM 'ACTIVE'::"AssessmentAssignmentStatus" THEN
        RAISE EXCEPTION 'Assessment assignment is not active';
    END IF;

    IF assignment_available_from IS NOT NULL
       AND CURRENT_TIMESTAMP < assignment_available_from THEN
        RAISE EXCEPTION 'Assessment assignment is not yet available';
    END IF;

    IF assignment_expires_at IS NOT NULL
       AND CURRENT_TIMESTAMP >= assignment_expires_at THEN
        RAISE EXCEPTION 'Assessment assignment has expired';
    END IF;

    IF NEW."attempt_number" > assignment_max_attempts THEN
        RAISE EXCEPTION 'Assessment attempt exceeds assignment attempt limit';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_attempt_assignment_guard"
BEFORE INSERT ON "assessment_attempts"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_attempt"();

-- ------------------------------------------------------------
-- Response scope validation
-- Item must belong to the exact AssessmentVersion assigned to
-- the attempt.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_response_scope"()
RETURNS TRIGGER AS $$
DECLARE
    attempt_version UUID;
    item_version UUID;
BEGIN
    SELECT aa."assessment_version_id"
      INTO attempt_version
      FROM "assessment_attempts" a
      JOIN "assessment_assignments" aa
        ON aa."id" = a."assignment_id"
     WHERE a."id" = NEW."attempt_id";

    SELECT "assessment_version_id"
      INTO item_version
      FROM "assessment_items"
     WHERE "id" = NEW."item_id";

    IF attempt_version IS NULL
       OR item_version IS NULL
       OR attempt_version IS DISTINCT FROM item_version THEN
        RAISE EXCEPTION
          'Assessment response item must belong to the attempt assessment version';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_response_scope_guard"
BEFORE INSERT OR UPDATE OF "attempt_id", "item_id"
ON "assessment_responses"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_response_scope"();

-- ------------------------------------------------------------
-- Option scope validation
-- A selected option must belong to the exact item represented
-- by the response.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_assessment_response_option"()
RETURNS TRIGGER AS $$
DECLARE
    response_item UUID;
    option_item UUID;
BEGIN
    SELECT "item_id"
      INTO response_item
      FROM "assessment_responses"
     WHERE "id" = NEW."response_id";

    SELECT "assessment_item_id"
      INTO option_item
      FROM "assessment_item_options"
     WHERE "id" = NEW."option_id";

    IF response_item IS NULL
       OR option_item IS NULL
       OR response_item IS DISTINCT FROM option_item THEN
        RAISE EXCEPTION
          'Selected response option must belong to the response item';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_response_option_scope_guard"
BEFORE INSERT OR UPDATE
ON "assessment_response_options"
FOR EACH ROW EXECUTE FUNCTION "validate_assessment_response_option"();

-- ------------------------------------------------------------
-- Response mutability
-- Responses/options may only change while an attempt is
-- IN_PROGRESS.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_finalized_assessment_response"()
RETURNS TRIGGER AS $$
DECLARE
    attempt_status "AssessmentAttemptStatus";
    target_attempt_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'assessment_responses' THEN
        target_attempt_id :=
            COALESCE(NEW."attempt_id", OLD."attempt_id");
    ELSE
        SELECT r."attempt_id"
          INTO target_attempt_id
          FROM "assessment_responses" r
         WHERE r."id" =
            COALESCE(NEW."response_id", OLD."response_id");
    END IF;

    SELECT "status"
      INTO attempt_status
      FROM "assessment_attempts"
     WHERE "id" = target_attempt_id;

    IF attempt_status IS DISTINCT FROM 'IN_PROGRESS'::"AssessmentAttemptStatus" THEN
        RAISE EXCEPTION
          'Responses for submitted or abandoned attempts are immutable';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_responses_finalization_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "assessment_responses"
FOR EACH ROW EXECUTE FUNCTION "protect_finalized_assessment_response"();

CREATE TRIGGER "assessment_response_options_finalization_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "assessment_response_options"
FOR EACH ROW EXECUTE FUNCTION "protect_finalized_assessment_response"();

-- ------------------------------------------------------------
-- Attempt lifecycle protection
-- Once finalized, attempts cannot be modified.
-- IN_PROGRESS may transition only to SUBMITTED or ABANDONED.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_assessment_attempt_history"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Assessment attempts cannot be deleted';
    END IF;

    IF OLD."status" IN (
        'SUBMITTED'::"AssessmentAttemptStatus",
        'ABANDONED'::"AssessmentAttemptStatus"
    ) THEN
        RAISE EXCEPTION 'Finalized assessment attempts are immutable';
    END IF;

    IF OLD."assignment_id" IS DISTINCT FROM NEW."assignment_id"
       OR OLD."attempt_number" IS DISTINCT FROM NEW."attempt_number"
       OR OLD."started_at" IS DISTINCT FROM NEW."started_at" THEN
        RAISE EXCEPTION 'Assessment attempt identity is immutable';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "assessment_attempt_history_guard"
BEFORE UPDATE OR DELETE
ON "assessment_attempts"
FOR EACH ROW EXECUTE FUNCTION "protect_assessment_attempt_history"();
