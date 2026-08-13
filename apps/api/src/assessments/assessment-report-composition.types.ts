export type AssessmentReportSchemaVersion =
  "assessment-report-data-v1" | "assessment-report-data-v2" | "assessment-report-data-v3";

export type AssessmentReportAudience = "CANDIDATE" | "PARENT" | "COUNSELOR" | "INSTITUTION";

export type AssessmentReportSectionKey =
  | "COVER"
  | "EXECUTIVE_SNAPSHOT"
  | "HOW_TO_USE"
  | "PLANNING_READINESS"
  | "PERSONALITY"
  | "INTERESTS"
  | "MOTIVATORS"
  | "LEARNING_PROFILE"
  | "APTITUDE_AND_ABILITIES"
  | "INTEGRATED_STRENGTH_MAP"
  | "CAREER_CLUSTERS"
  | "CAREER_PATHS"
  | "PRIORITY_CAREER_DEEP_DIVE"
  | "SUBJECT_STREAM_GUIDANCE"
  | "EDUCATION_ROADMAP"
  | "CAREER_ENVIRONMENT"
  | "DEVELOPMENT_PLAN"
  | "COUNSELOR_DISCUSSION"
  | "ASSESSMENT_RESULTS"
  | "PROVENANCE";

export type AssessmentReportDataRequirement =
  | "ALWAYS"
  | "PLANNING_READINESS"
  | "CAREER_FIT"
  | "GUIDANCE_CONTENT"
  | "MARKET_SNAPSHOT"
  | "COUNSELOR_ANNOTATION";

export interface AssessmentReportTemplateSection {
  key: AssessmentReportSectionKey;
  title: string;
  required: boolean;
  dataRequirement: AssessmentReportDataRequirement;
}

export interface AssessmentReportTemplateDefinition {
  templateId: string;
  templateVersion: string;
  audience: AssessmentReportAudience;
  sections: readonly AssessmentReportTemplateSection[];
}

export interface AssessmentReportCompositionConfiguration {
  templateId: string;
  templateVersion: string;
  audience: AssessmentReportAudience;
  locale: string;
  enabledSections?: AssessmentReportSectionKey[];
}

export interface AssessmentReportPayloadV3 {
  schemaVersion: "assessment-report-data-v3";
  candidate?: unknown;
  submission?: unknown;
  assessment: unknown;
  scoring: unknown;
  norms: unknown[];
  interpretation: unknown;
  planningReadiness?: unknown;
  careerFit?: unknown;
  guidanceContent?: unknown;
  marketSnapshot?: unknown;
  counselorAnnotation?: unknown;
  reportComposition: AssessmentReportCompositionConfiguration;
  provenance?: unknown;
}

export interface AssessmentReportCompositionPlan {
  schemaVersion: AssessmentReportSchemaVersion;
  templateId: string;
  templateVersion: string;
  audience: AssessmentReportAudience;
  locale: string;
  sections: AssessmentReportTemplateSection[];
}

export function getAssessmentReportSchemaVersion(
  value: unknown,
): AssessmentReportSchemaVersion | null {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) {
    return null;
  }

  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;

  if (
    schemaVersion === "assessment-report-data-v1" ||
    schemaVersion === "assessment-report-data-v2" ||
    schemaVersion === "assessment-report-data-v3"
  ) {
    return schemaVersion;
  }

  return null;
}

export function isAssessmentReportPayloadV3(value: unknown): value is AssessmentReportPayloadV3 {
  if (getAssessmentReportSchemaVersion(value) !== "assessment-report-data-v3") {
    return false;
  }

  const payload = value as Partial<AssessmentReportPayloadV3>;
  const composition = payload.reportComposition;

  return Boolean(
    composition &&
    typeof composition.templateId === "string" &&
    typeof composition.templateVersion === "string" &&
    typeof composition.locale === "string" &&
    (composition.audience === "CANDIDATE" ||
      composition.audience === "PARENT" ||
      composition.audience === "COUNSELOR" ||
      composition.audience === "INSTITUTION") &&
    Array.isArray(payload.norms),
  );
}

export function hasAssessmentReportDataRequirement(
  payload: AssessmentReportPayloadV3,
  requirement: AssessmentReportDataRequirement,
): boolean {
  switch (requirement) {
    case "ALWAYS":
      return true;
    case "PLANNING_READINESS":
      return payload.planningReadiness !== undefined && payload.planningReadiness !== null;
    case "CAREER_FIT":
      return payload.careerFit !== undefined && payload.careerFit !== null;
    case "GUIDANCE_CONTENT":
      return payload.guidanceContent !== undefined && payload.guidanceContent !== null;
    case "MARKET_SNAPSHOT":
      return payload.marketSnapshot !== undefined && payload.marketSnapshot !== null;
    case "COUNSELOR_ANNOTATION":
      return payload.counselorAnnotation !== undefined && payload.counselorAnnotation !== null;
  }
}
