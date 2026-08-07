-- Phase 2A.1: explicit immutable instrument-version identifiers required by the SRS.

ALTER TABLE "assessment_versions"
    ADD COLUMN "edition" VARCHAR(60),
    ADD COLUMN "form" VARCHAR(60),
    ADD COLUMN "language" VARCHAR(20),
    ADD COLUMN "scoring_version" VARCHAR(60),
    ADD COLUMN "norm_version" VARCHAR(60),
    ADD COLUMN "report_version" VARCHAR(60);

-- No assessment versions exist in production yet; the migration remains forward-only.
ALTER TABLE "assessment_versions"
    ALTER COLUMN "edition" SET NOT NULL,
    ALTER COLUMN "form" SET NOT NULL,
    ALTER COLUMN "language" SET NOT NULL,
    ALTER COLUMN "scoring_version" SET NOT NULL,
    ALTER COLUMN "norm_version" SET NOT NULL,
    ALTER COLUMN "report_version" SET NOT NULL;

CREATE INDEX "assessment_versions_identity_idx"
    ON "assessment_versions"(
        "assessment_definition_id",
        "edition",
        "form",
        "language"
    );
