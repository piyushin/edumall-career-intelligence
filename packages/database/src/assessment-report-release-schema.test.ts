import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("RC1 assessment report release schema", () => {
  it("generates immutable report release evidence with snapshot uniqueness", () => {
    const release = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentReportRelease",
    );

    expect(release).toBeDefined();
    expect(release?.uniqueFields).toContainEqual(["attemptId", "reportDataSnapshotId"]);
    expect(release?.fields.find((field) => field.name === "organizationId")?.isRequired).toBe(true);
    expect(release?.fields.find((field) => field.name === "releasedByUserId")?.isRequired).toBe(
      true,
    );
  });

  it("ships foreign-key protected release history", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260818090000_rc1_assessment_report_release/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain('CREATE TABLE "assessment_report_releases"');
    expect(migration).toContain('REFERENCES "assessment_attempts"("id")');
    expect(migration).toContain('REFERENCES "assessment_report_data_snapshots"("id")');
    expect(migration).toContain('REFERENCES "users"("id")');
  });
});
