import { readFileSync } from "node:fs";
import { AssessmentItemType, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2B assessment item schema", () => {
  it("generates constructs, items, options, item mappings, and option scoring models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentConstruct");
    expect(modelNames).toContain("AssessmentItem");
    expect(modelNames).toContain("AssessmentItemOption");
    expect(modelNames).toContain("AssessmentItemConstruct");
    expect(modelNames).toContain("AssessmentOptionScore");

    expect(Object.values(AssessmentItemType)).toEqual([
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "LIKERT",
      "BOOLEAN",
      "NUMERIC",
      "TEXT",
    ]);
  });

  it("keeps item and construct codes unique inside one assessment version", () => {
    const item = Prisma.dmmf.datamodel.models.find((model) => model.name === "AssessmentItem");
    const construct = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentConstruct",
    );

    expect(item?.uniqueFields).toContainEqual(["assessmentVersionId", "code"]);
    expect(item?.uniqueFields).toContainEqual(["assessmentVersionId", "orderIndex"]);

    expect(construct?.uniqueFields).toContainEqual(["assessmentVersionId", "code"]);
  });

  it("ships database guards for same-version scoring and published content immutability", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807160000_phase_2b_item_bank_constructs_scoring/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("validate_assessment_scoring_scope");
    expect(migration).toContain(
      "Assessment scoring relationships must remain within one assessment version",
    );
    expect(migration).toContain("protect_published_assessment_content");
    expect(migration).toContain("Published or retired assessment content is immutable");
  });
});
