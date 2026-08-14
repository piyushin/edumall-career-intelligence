import { readFileSync } from "node:fs";
import {
  CareerFitFactorDirection,
  CareerFitModelStatus,
  CareerTaxonomyStatus,
  CareerTaxonomyVersionStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 5C.1 career taxonomy and fit schema", () => {
  it("generates the governed taxonomy, model, run and evidence models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);
    for (const model of [
      "CareerTaxonomy",
      "CareerTaxonomyVersion",
      "CareerCluster",
      "CareerPath",
      "CareerFitModel",
      "CareerFitModelFactor",
      "CareerFitRecommendationBand",
      "CareerFitRun",
      "CareerFitResult",
    ]) {
      expect(modelNames).toContain(model);
    }

    expect(Object.values(CareerTaxonomyStatus)).toEqual(["ACTIVE", "ARCHIVED"]);
    expect(Object.values(CareerTaxonomyVersionStatus)).toEqual(["DRAFT", "PUBLISHED", "RETIRED"]);
    expect(Object.values(CareerFitModelStatus)).toEqual(["DRAFT", "PUBLISHED", "RETIRED"]);
    expect(Object.values(CareerFitFactorDirection)).toEqual(["POSITIVE", "NEGATIVE"]);
  });

  it("makes deterministic fit runs content-addressed and ranked results unique", () => {
    const run = Prisma.dmmf.datamodel.models.find((model) => model.name === "CareerFitRun");
    const result = Prisma.dmmf.datamodel.models.find((model) => model.name === "CareerFitResult");

    expect(run?.uniqueFields).toContainEqual(["scoringRunId", "careerFitModelId", "inputHash"]);
    expect(result?.uniqueFields).toContainEqual(["careerFitRunId", "rank"]);
    expect(result?.fields.find((field) => field.name === "evidenceData")?.isRequired).toBe(true);
  });

  it("ships cross-version and history guards without scientific seed data", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260812220000_phase_5c1_career_taxonomy_fit_foundation/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("validate_career_fit_factor_scope");
    expect(migration).toContain("protect_career_taxonomy_version_history");
    expect(migration).toContain("protect_career_fit_model_history");
    expect(migration).toContain("protect_career_taxonomy_child_history");
    expect(migration).toContain("protect_career_fit_model_child_history");
    expect(migration).toContain("career_fit_runs_immutable_guard");
    expect(migration).not.toContain('INSERT INTO "career_fit_model_factors"');
    expect(migration).not.toContain('INSERT INTO "career_fit_recommendation_bands"');
  });
});
