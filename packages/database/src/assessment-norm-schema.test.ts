import { readFileSync } from "node:fs";
import { AssessmentNormSetStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2E assessment norm schema", () => {
  it("generates norm-set, norm-group, construct-table, and lookup-row models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentNormSet");
    expect(modelNames).toContain("AssessmentNormGroup");
    expect(modelNames).toContain("AssessmentConstructNormTable");
    expect(modelNames).toContain("AssessmentNormLookupRow");

    expect(Object.values(AssessmentNormSetStatus)).toEqual(["DRAFT", "PUBLISHED", "RETIRED"]);
  });

  it("keeps one norm version per assessment version and one construct table per norm group", () => {
    const normSet = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentNormSet",
    );

    const constructTable = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentConstructNormTable",
    );

    expect(normSet?.uniqueFields).toContainEqual(["assessmentVersionId", "normVersion"]);

    expect(constructTable?.uniqueFields).toContainEqual(["normGroupId", "assessmentConstructId"]);
  });

  it("ships version, scope, and published-content guards without seeding norm values", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807173000_phase_2e_norm_foundation/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain(
      "Norm set version must match the assessment version norm identifier",
    );

    expect(migration).toContain(
      "Norm construct must belong to the same assessment version as the norm set",
    );

    expect(migration).toContain("Published or retired norm content is immutable");

    expect(migration).not.toContain("INSERT INTO");
  });
});
