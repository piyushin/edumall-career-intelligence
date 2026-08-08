import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2F assessment norm application schema", () => {
  it("generates immutable norm-application provenance records", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentNormApplication");
  });

  it("keeps one norm-group application per construct score", () => {
    const application = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentNormApplication",
    );

    expect(application?.uniqueFields).toContainEqual([
      "scoringRunId",
      "assessmentConstructId",
      "normGroupId",
    ]);
  });

  it("ships full provenance and immutability guards", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807180000_phase_2f_norm_application/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain(
      "Norm application raw score must match the stored construct raw score",
    );

    expect(migration).toContain("Only published norm sets may be applied");

    expect(migration).toContain("Norm set must belong to the scored assessment version");

    expect(migration).toContain("Norm table must match the selected group and construct");

    expect(migration).toContain("Raw score is outside the selected norm lookup interval");

    expect(migration).toContain("Standardized score must match the selected norm lookup row");

    expect(migration).toContain("Percentile must match the selected norm lookup row");

    expect(migration).toContain("Assessment norm application history is immutable");
  });
});
