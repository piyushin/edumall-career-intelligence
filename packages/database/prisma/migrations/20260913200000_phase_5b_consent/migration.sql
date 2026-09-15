-- Phase 5B: versioned consent documents and acceptance evidence (D-013).
-- No consent document content is seeded; publishing legal text is an admin action.

ALTER TABLE "users"
    ADD COLUMN "date_of_birth" DATE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_date_of_birth_not_future_check"
    CHECK ("date_of_birth" IS NULL OR "date_of_birth" <= CURRENT_DATE);

CREATE TYPE "ConsentDocumentType" AS ENUM (
    'PRIVACY_NOTICE',
    'ASSESSMENT_DATA_PROCESSING'
);

CREATE TYPE "ConsentDocumentStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'RETIRED'
);

CREATE TYPE "ConsentAcceptorRole" AS ENUM (
    'SELF',
    'GUARDIAN',
    'STUDENT_ASSENT'
);

CREATE TABLE "consent_documents" (
    "id" UUID NOT NULL,
    "type" "ConsentDocumentType" NOT NULL,
    "version" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body_text" TEXT NOT NULL,
    "status" "ConsentDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_documents_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "consent_documents_lifecycle_check"
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

CREATE TABLE "user_consent_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_document_id" UUID NOT NULL,
    "accepted_by_role" "ConsentAcceptorRole" NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guardian_name" VARCHAR(200),
    "guardian_email" VARCHAR(320),
    "guardian_relationship" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consent_records_pkey"
        PRIMARY KEY ("id"),

    CONSTRAINT "user_consent_records_guardian_fields_check"
        CHECK (
            (
                "accepted_by_role" = 'GUARDIAN'
                AND "guardian_name" IS NOT NULL
                AND "guardian_email" IS NOT NULL
                AND "guardian_relationship" IS NOT NULL
            )
            OR
            (
                "accepted_by_role" <> 'GUARDIAN'
                AND "guardian_name" IS NULL
                AND "guardian_email" IS NULL
                AND "guardian_relationship" IS NULL
            )
        )
);

CREATE UNIQUE INDEX
    "consent_documents_type_version_key"
ON "consent_documents"(
    "type",
    "version"
);

CREATE INDEX
    "consent_documents_type_status_idx"
ON "consent_documents"(
    "type",
    "status"
);

CREATE INDEX
    "consent_documents_status_published_at_idx"
ON "consent_documents"(
    "status",
    "published_at"
);

-- Only one PUBLISHED document per type at a time.
CREATE UNIQUE INDEX
    "consent_documents_one_published_per_type"
ON "consent_documents"("type")
WHERE "status" = 'PUBLISHED';

-- A minor's flow needs two different-role acceptances (GUARDIAN and
-- STUDENT_ASSENT) against the same document, so the role is part of the key --
-- (user_id, consent_document_id) alone would let the second acceptance collide
-- with the first and never actually get recorded.
CREATE UNIQUE INDEX
    "user_consent_records_user_id_consent_document_id_accepted_by_role_key"
ON "user_consent_records"(
    "user_id",
    "consent_document_id",
    "accepted_by_role"
);

CREATE INDEX
    "user_consent_records_user_id_idx"
ON "user_consent_records"("user_id");

CREATE INDEX
    "user_consent_records_consent_document_id_idx"
ON "user_consent_records"("consent_document_id");

ALTER TABLE "user_consent_records"
    ADD CONSTRAINT
        "user_consent_records_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_consent_records"
    ADD CONSTRAINT
        "user_consent_records_consent_document_id_fkey"
    FOREIGN KEY ("consent_document_id")
    REFERENCES "consent_documents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- Published or retired consent document content is immutable;
-- a published document may only transition to retired.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_published_consent_document"()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD."status" <> 'DRAFT' THEN
        RAISE EXCEPTION
          'Published or retired consent documents cannot be deleted';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD."status" = 'RETIRED' THEN
            RAISE EXCEPTION
              'Retired consent documents are immutable';
        END IF;

        IF OLD."status" = 'PUBLISHED' THEN
            IF NEW."status" <> 'RETIRED' THEN
                RAISE EXCEPTION
                  'Published consent documents may only transition to retired';
            END IF;

            IF NEW."type" IS DISTINCT FROM OLD."type"
               OR NEW."version" IS DISTINCT FROM OLD."version"
               OR NEW."title" IS DISTINCT FROM OLD."title"
               OR NEW."body_text" IS DISTINCT FROM OLD."body_text"
               OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
               OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
                RAISE EXCEPTION
                  'Published consent document content is immutable';
            END IF;
        END IF;
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "consent_documents_content_guard"
BEFORE UPDATE OR DELETE
ON "consent_documents"
FOR EACH ROW EXECUTE FUNCTION
    "protect_published_consent_document"();

-- ------------------------------------------------------------
-- A consent record may only reference a published document.
-- ------------------------------------------------------------

CREATE FUNCTION "validate_user_consent_record_document"()
RETURNS TRIGGER AS $$
DECLARE
    document_status "ConsentDocumentStatus";
BEGIN
    SELECT "status"
      INTO document_status
      FROM "consent_documents"
     WHERE "id" = NEW."consent_document_id";

    IF document_status IS DISTINCT FROM 'PUBLISHED'::"ConsentDocumentStatus" THEN
        RAISE EXCEPTION
          'Only a published consent document may be accepted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_consent_record_document_guard"
BEFORE INSERT
ON "user_consent_records"
FOR EACH ROW EXECUTE FUNCTION
    "validate_user_consent_record_document"();

-- ------------------------------------------------------------
-- Consent acceptance evidence is append-only.
-- ------------------------------------------------------------

CREATE FUNCTION "protect_user_consent_record_history"()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
      'Consent acceptance records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_consent_records_history_guard"
BEFORE UPDATE OR DELETE
ON "user_consent_records"
FOR EACH ROW EXECUTE FUNCTION
    "protect_user_consent_record_history"();
