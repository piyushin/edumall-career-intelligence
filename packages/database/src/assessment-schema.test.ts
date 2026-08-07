import { readFileSync } from "node:fs";
import { AssessmentDefinitionStatus, AssessmentVersionStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2A assessment schema", () => {
  it("generates the stable definition and version models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentDefinition");
    expect(modelNames).toContain("AssessmentVersion");

    expect(Object.values(AssessmentDefinitionStatus)).toEqual(["ACTIVE", "ARCHIVED"]);
    expect(Object.values(AssessmentVersionStatus)).toEqual(["DRAFT", "PUBLISHED", "RETIRED"]);
  });

  it("keeps assessment versions uniquely numbered per definition", () => {
    const version = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentVersion",
    );

    expect(version).toBeDefined();
    expect(version?.fields.find((field) => field.name === "versionNumber")?.type).toBe("Int");
    expect(version?.uniqueFields).toContainEqual(["assessmentDefinitionId", "versionNumber"]);
  });

  it("ships database guards for lifecycle validity and published-version immutability", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807144000_phase_2a_assessment_definition_versioning/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("assessment_versions_version_number_check");
    expect(migration).toContain("assessment_versions_lifecycle_check");
    expect(migration).toContain("protect_assessment_version_history");
    expect(migration).toContain("Published or retired assessment versions cannot be deleted");
    expect(migration).toContain("Published assessment version content is immutable");
  });
});
