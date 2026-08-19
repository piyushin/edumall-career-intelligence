-- RC1 counselor review/release evidence.
-- Each row releases exactly one immutable report-data snapshot to the candidate.
CREATE TABLE "assessment_report_releases" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "report_data_snapshot_id" UUID NOT NULL,
    "released_by_user_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "assessment_report_releases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessment_report_releases_attempt_id_report_data_snapshot_id_key"
ON "assessment_report_releases"("attempt_id", "report_data_snapshot_id");

CREATE INDEX "assessment_report_releases_organization_id_released_at_idx"
ON "assessment_report_releases"("organization_id", "released_at");

CREATE INDEX "assessment_report_releases_attempt_id_released_at_idx"
ON "assessment_report_releases"("attempt_id", "released_at");

CREATE INDEX "assessment_report_releases_report_data_snapshot_id_idx"
ON "assessment_report_releases"("report_data_snapshot_id");

CREATE INDEX "assessment_report_releases_released_by_user_id_released_at_idx"
ON "assessment_report_releases"("released_by_user_id", "released_at");

ALTER TABLE "assessment_report_releases"
ADD CONSTRAINT "assessment_report_releases_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_releases"
ADD CONSTRAINT "assessment_report_releases_attempt_id_fkey"
FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_releases"
ADD CONSTRAINT "assessment_report_releases_report_data_snapshot_id_fkey"
FOREIGN KEY ("report_data_snapshot_id") REFERENCES "assessment_report_data_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assessment_report_releases"
ADD CONSTRAINT "assessment_report_releases_released_by_user_id_fkey"
FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
