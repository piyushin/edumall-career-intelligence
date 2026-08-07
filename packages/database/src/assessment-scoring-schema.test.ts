import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2D scoring persistence schema", () => {
  it("generates immutable scoring-run and construct-score models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentScoringRun");
    expect(modelNames).toContain("AssessmentConstructScore");
  });

  it("prevents duplicate scoring provenance records", () => {
    const scoringRun = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentScoringRun",
    );

    expect(scoringRun?.uniqueFields).toContainEqual([
      "attemptId",
      "scoringVersion",
      "algorithmVersion",
      "inputHash",
    ]);
  });

  it("ships database guards for submitted attempts, version scope, and immutable history", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807170000_phase_2d_deterministic_scoring/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("Only submitted assessment attempts may be scored");

    expect(migration).toContain(
      "Scoring run version must match the assessment version scoring identifier",
    );

    expect(migration).toContain("Construct score must belong to the scored assessment version");

    expect(migration).toContain("Assessment scoring history is immutable");
  });
});
