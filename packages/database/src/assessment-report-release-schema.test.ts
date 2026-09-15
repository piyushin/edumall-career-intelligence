import { readFileSync } from "node:fs";
import { AssessmentReportReleaseStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 5A report release schema", () => {
  it("generates the report release and counsellor note models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentReportRelease");
    expect(modelNames).toContain("AssessmentCounsellorNote");

    expect(Object.values(AssessmentReportReleaseStatus)).toEqual([
      "PENDING_REVIEW",
      "RELEASED",
      "WITHDRAWN",
    ]);
  });

  it("keeps one release per attempt", () => {
    const release = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentReportRelease",
    );

    const attemptField = release?.fields.find((field) => field.name === "attemptId");

    expect(attemptField?.isUnique).toBe(true);
  });

  it("ships scope, lifecycle, and transition guards without seeding release or note content", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260913190000_phase_5a_report_release/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("Report release organization must match the attempt tenant");

    expect(migration).toContain("Report release snapshot must belong to the same attempt");

    expect(migration).toContain("Report release identity fields are immutable");

    expect(migration).toContain(
      "Report release status may only move PENDING_REVIEW -> RELEASED -> WITHDRAWN",
    );

    expect(migration).toContain("Counsellor note organization must match the attempt tenant");

    expect(migration).toContain("Counsellor note identity fields are immutable");

    expect(migration).toContain("assessment_report_releases_lifecycle_check");

    expect(migration).toContain("assessment_counsellor_notes_body_check");

    expect(migration).not.toContain("INSERT INTO");
  });
});
