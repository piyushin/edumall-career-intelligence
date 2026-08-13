import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AssessmentReportCompositionService } from "./assessment-report-composition.service";

describe("AssessmentReportCompositionService", () => {
  const service = new AssessmentReportCompositionService();

  it("preserves the existing governed report composition for v2 snapshots", () => {
    const plan = service.compose({
      schemaVersion: "assessment-report-data-v2",
    });

    expect(plan.templateId).toBe("governed-assessment-report");
    expect(plan.sections.map((section) => section.key)).toEqual([
      "COVER",
      "ASSESSMENT_RESULTS",
      "PROVENANCE",
    ]);
  });

  it("builds the career intelligence section plan deterministically for a valid v3 payload", () => {
    const plan = service.compose({
      schemaVersion: "assessment-report-data-v3",
      assessment: {},
      scoring: {},
      norms: [],
      interpretation: {},
      planningReadiness: { stage: "METHODICAL" },
      careerFit: { modelVersion: "synthetic-qa-only" },
      guidanceContent: { contentSetVersion: "synthetic-qa-only" },
      reportComposition: {
        templateId: "career-intelligence-student",
        templateVersion: "1",
        audience: "CANDIDATE",
        locale: "en-IN",
      },
    });

    expect(plan.sections.map((section) => section.key)).toEqual([
      "COVER",
      "EXECUTIVE_SNAPSHOT",
      "HOW_TO_USE",
      "PLANNING_READINESS",
      "PERSONALITY",
      "INTERESTS",
      "MOTIVATORS",
      "LEARNING_PROFILE",
      "APTITUDE_AND_ABILITIES",
      "INTEGRATED_STRENGTH_MAP",
      "CAREER_CLUSTERS",
      "CAREER_PATHS",
      "PRIORITY_CAREER_DEEP_DIVE",
      "SUBJECT_STREAM_GUIDANCE",
      "EDUCATION_ROADMAP",
      "DEVELOPMENT_PLAN",
      "PROVENANCE",
    ]);
  });

  it("does not include time-sensitive market content without a market snapshot", () => {
    const plan = service.compose({
      schemaVersion: "assessment-report-data-v3",
      assessment: {},
      scoring: {},
      norms: [],
      interpretation: {},
      reportComposition: {
        templateId: "career-intelligence-student",
        templateVersion: "1",
        audience: "CANDIDATE",
        locale: "en-IN",
      },
    });

    expect(plan.sections.some((section) => section.key === "CAREER_ENVIRONMENT")).toBe(false);
  });

  it("honors optional-section selection without allowing required sections to be removed", () => {
    const plan = service.compose({
      schemaVersion: "assessment-report-data-v3",
      assessment: {},
      scoring: {},
      norms: [],
      interpretation: {},
      careerFit: { modelVersion: "synthetic-qa-only" },
      reportComposition: {
        templateId: "career-intelligence-student",
        templateVersion: "1",
        audience: "CANDIDATE",
        locale: "en-IN",
        enabledSections: ["CAREER_CLUSTERS"],
      },
    });

    expect(plan.sections.map((section) => section.key)).toEqual([
      "COVER",
      "EXECUTIVE_SNAPSHOT",
      "HOW_TO_USE",
      "PERSONALITY",
      "INTERESTS",
      "MOTIVATORS",
      "LEARNING_PROFILE",
      "APTITUDE_AND_ABILITIES",
      "CAREER_CLUSTERS",
      "PROVENANCE",
    ]);
  });

  it("rejects unsupported schemas and template versions", () => {
    expect(() => service.compose({ schemaVersion: "assessment-report-data-v99" })).toThrow(
      ConflictException,
    );

    expect(() =>
      service.compose({
        schemaVersion: "assessment-report-data-v3",
        assessment: {},
        scoring: {},
        norms: [],
        interpretation: {},
        reportComposition: {
          templateId: "career-intelligence-student",
          templateVersion: "999",
          audience: "CANDIDATE",
          locale: "en-IN",
        },
      }),
    ).toThrow(ConflictException);
  });
});
