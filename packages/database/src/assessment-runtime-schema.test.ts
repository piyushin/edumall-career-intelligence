import { readFileSync } from "node:fs";
import { AssessmentAssignmentStatus, AssessmentAttemptStatus, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Phase 2C assessment runtime schema", () => {
  it("generates assignment, attempt, response, and response-option models", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    expect(modelNames).toContain("AssessmentAssignment");
    expect(modelNames).toContain("AssessmentAttempt");
    expect(modelNames).toContain("AssessmentResponse");
    expect(modelNames).toContain("AssessmentResponseOption");

    expect(Object.values(AssessmentAssignmentStatus)).toEqual(["ACTIVE", "CANCELLED", "EXPIRED"]);

    expect(Object.values(AssessmentAttemptStatus)).toEqual([
      "IN_PROGRESS",
      "SUBMITTED",
      "ABANDONED",
    ]);
  });

  it("keeps one response per item per attempt and sequential attempt identity", () => {
    const response = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentResponse",
    );

    const attempt = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "AssessmentAttempt",
    );

    expect(response?.uniqueFields).toContainEqual(["attemptId", "itemId"]);

    expect(attempt?.uniqueFields).toContainEqual(["assignmentId", "attemptNumber"]);
  });

  it("ships database guards for assignment, response scope, and finalized history", () => {
    const migration = readFileSync(
      new URL(
        "../prisma/migrations/20260807163000_phase_2c_assignment_attempt_response/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("Only published assessment versions may be assigned");

    expect(migration).toContain("Assessment attempt exceeds assignment attempt limit");

    expect(migration).toContain(
      "Assessment response item must belong to the attempt assessment version",
    );

    expect(migration).toContain("Selected response option must belong to the response item");

    expect(migration).toContain("Responses for submitted or abandoned attempts are immutable");

    expect(migration).toContain("Finalized assessment attempts are immutable");
  });
});
