import { readFileSync } from "node:fs";
import {
  AssessmentInterpretationMetric,
  AssessmentInterpretationSetStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2G interpretation and report-data schema", () => {
  it("generates interpretation and report-data provenance models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentInterpretationSet");
    expect(modelNames).toContain("AssessmentInterpretationRule");
    expect(modelNames).toContain("AssessmentInterpretationApplication");
    expect(modelNames).toContain("AssessmentReportDataSnapshot");

    expect(Object.values(AssessmentInterpretationSetStatus)).toEqual([
      "DRAFT",
      "PUBLISHED",
      "RETIRED",
    ]);

    expect(Object.values(AssessmentInterpretationMetric)).toEqual([
      "RAW_SCORE",
      "STANDARDIZED_SCORE",
      "PERCENTILE",
    ]);
  });

  it("keeps interpretation versions and report snapshots reproducible", () => {
    const interpretationSet = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentInterpretationSet",
    );

    const snapshot = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentReportDataSnapshot",
    );

    expect(interpretationSet?.uniqueFields).toContainEqual(["assessmentVersionId", "version"]);

    expect(snapshot?.uniqueFields).toContainEqual(["scoringRunId", "reportVersion", "inputHash"]);
  });

  it("ships scope, publication, metric, report-version, and immutability guards without seeded interpretations", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807183000_phase_2g_interpretation_report_data/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("Only published interpretation sets may be applied");

    expect(migration).toContain("Interpretation metric value must match the normalized result");

    expect(migration).toContain(
      "Interpretation output must match the published interpretation rule",
    );

    expect(migration).toContain("Report data version must match the assessment report identifier");

    expect(migration).toContain("Published or retired interpretation rules are immutable");

    expect(migration).toContain("Assessment interpretation and report-data history is immutable");

    expect(migration).not.toContain("INSERT INTO");
  });
});
