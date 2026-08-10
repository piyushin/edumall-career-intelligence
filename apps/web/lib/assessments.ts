import { apiRequest } from "./api";

export type AssessmentDefinitionStatus = "ACTIVE" | "ARCHIVED";
export type AssessmentVersionStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export type AssessmentItemType =
  "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "LIKERT" | "BOOLEAN" | "NUMERIC" | "TEXT";

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
  description?: string | null;
  instructions?: string | null;
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

export interface AssessmentConstruct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  orderIndex: number;
}

export interface AssessmentItemConstructLink {
  assessmentConstructId: string;
  weight: number | string;
  reverseScored: boolean;
}

export interface AssessmentOptionScore {
  assessmentConstructId: string;
  score: number | string;
}

export interface AssessmentItemOption {
  id: string;
  code: string;
  label: string;
  orderIndex: number;
  scores: AssessmentOptionScore[];
}

export interface AssessmentItem {
  id: string;
  code: string;
  type: AssessmentItemType;
  prompt: string;
  helpText: string | null;
  orderIndex: number;
  required: boolean;
  constructLinks: AssessmentItemConstructLink[];
  options: AssessmentItemOption[];
}

export interface AssessmentVersionContent {
  id: string;
  versionNumber: number;
  status: "DRAFT";
  constructs: AssessmentConstruct[];
  items: AssessmentItem[];
}

export interface PublicationIssue {
  code: string;
  message: string;
  itemId?: string;
  optionId?: string;
  constructId?: string;
}

export interface PublicationReadiness {
  versionId: string;
  ready: boolean;
  issues: PublicationIssue[];
}

export interface CreateVersionInput {
  versionNumber: number;
  title: string;
  edition: string;
  form: string;
  language: string;
  scoringVersion: string;
  normVersion: string;
  reportVersion: string;
  description?: string;
  instructions?: string;
}

export async function listAssessmentDefinitions(): Promise<AssessmentDefinitionSummary[]> {
  return apiRequest<AssessmentDefinitionSummary[]>("/admin/assessments");
}

export async function getAssessmentDefinition(
  definitionId: string,
): Promise<AssessmentDefinitionSummary> {
  return apiRequest<AssessmentDefinitionSummary>(`/admin/assessments/${definitionId}`);
}

export async function createAssessmentDefinition(input: {
  code: string;
}): Promise<AssessmentDefinitionSummary> {
  return apiRequest<AssessmentDefinitionSummary>("/admin/assessments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createAssessmentVersion(
  definitionId: string,
  input: CreateVersionInput,
): Promise<AssessmentVersionSummary> {
  return apiRequest<AssessmentVersionSummary>(`/admin/assessments/${definitionId}/versions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAssessmentVersionContent(
  definitionId: string,
  versionId: string,
): Promise<AssessmentVersionContent> {
  return apiRequest<AssessmentVersionContent>(
    `/admin/assessments/${definitionId}/versions/${versionId}/content`,
  );
}

export async function createAssessmentConstruct(
  definitionId: string,
  versionId: string,
  input: {
    code: string;
    name: string;
    orderIndex: number;
    description?: string;
  },
): Promise<AssessmentConstruct> {
  return apiRequest<AssessmentConstruct>(
    `/admin/assessments/${definitionId}/versions/${versionId}/constructs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createAssessmentItem(
  definitionId: string,
  versionId: string,
  input: {
    code: string;
    type: AssessmentItemType;
    prompt: string;
    orderIndex: number;
    required?: boolean;
    helpText?: string;
  },
): Promise<AssessmentItem> {
  return apiRequest<AssessmentItem>(
    `/admin/assessments/${definitionId}/versions/${versionId}/items`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createAssessmentItemOption(
  definitionId: string,
  versionId: string,
  itemId: string,
  input: {
    code: string;
    label: string;
    orderIndex: number;
  },
): Promise<AssessmentItemOption> {
  return apiRequest<AssessmentItemOption>(
    `/admin/assessments/${definitionId}/versions/${versionId}/items/${itemId}/options`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createAssessmentItemConstructLink(
  definitionId: string,
  versionId: string,
  itemId: string,
  input: {
    constructId: string;
    weight?: number;
    reverseScored?: boolean;
  },
): Promise<void> {
  await apiRequest(
    `/admin/assessments/${definitionId}/versions/${versionId}/items/${itemId}/constructs`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createAssessmentOptionScore(
  definitionId: string,
  versionId: string,
  itemId: string,
  optionId: string,
  input: {
    constructId: string;
    score: number;
  },
): Promise<void> {
  await apiRequest(
    `/admin/assessments/${definitionId}/versions/${versionId}/items/${itemId}/options/${optionId}/scores`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function getPublicationReadiness(
  definitionId: string,
  versionId: string,
): Promise<PublicationReadiness> {
  return apiRequest<PublicationReadiness>(
    `/admin/assessments/${definitionId}/versions/${versionId}/publication-readiness`,
  );
}

export async function publishAssessmentVersion(
  definitionId: string,
  versionId: string,
): Promise<AssessmentVersionSummary> {
  return apiRequest<AssessmentVersionSummary>(
    `/admin/assessments/${definitionId}/versions/${versionId}/publish`,
    {
      method: "POST",
    },
  );
}
