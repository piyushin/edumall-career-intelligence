import { apiRequest } from "./api";

export type AssessmentDefinitionStatus = "ACTIVE" | "ARCHIVED";
export type AssessmentVersionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export interface AssessmentVersionSummary {
  id: string;
  versionNumber: number;
  status: AssessmentVersionStatus;
  title: string;
  edition: string;
  form: string;
  language: string;
  scoringVersion: string;
  normVersion: string;
  reportVersion: string;
  createdAt: string;
  publishedAt: string | null;
  retiredAt: string | null;
}

export interface AssessmentDefinitionSummary {
  id: string;
  organizationId: string | null;
  code: string;
  status: AssessmentDefinitionStatus;
  createdAt: string;
  updatedAt: string;
  versions: AssessmentVersionSummary[];
}

export async function listAssessmentDefinitions(): Promise<AssessmentDefinitionSummary[]> {
  return apiRequest<AssessmentDefinitionSummary[]>("/admin/assessments");
}

export async function createAssessmentDefinition(input: {
  code: string;
}): Promise<AssessmentDefinitionSummary> {
  return apiRequest<AssessmentDefinitionSummary>("/admin/assessments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
