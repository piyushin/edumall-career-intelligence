import { apiRequest } from "./api";

export type InterpretationSetStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type InterpretationMetric = "RAW_SCORE" | "STANDARDIZED_SCORE" | "PERCENTILE";

export interface InterpretationSetSummary {
  id: string;
  assessmentVersionId: string;
  version: string;
  name: string;
  description: string | null;
  sourceReference: string | null;
  status: InterpretationSetStatus;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
}

export interface InterpretationRule {
  id: string;
  assessmentConstructId: string;
  assessmentConstruct: { code: string; name: string };
  code: string;
  metric: InterpretationMetric;
  lowerBound: number | string | null;
  upperBound: number | string | null;
  lowerInclusive: boolean;
  upperInclusive: boolean;
  priority: number;
  outputData: unknown;
}

export interface InterpretationSetDetail extends InterpretationSetSummary {
  rules: InterpretationRule[];
}

export interface InterpretationPublicationIssue {
  code: string;
  message: string;
  constructId?: string;
}

export interface InterpretationPublicationReadiness {
  interpretationSetId: string;
  ready: boolean;
  issues: InterpretationPublicationIssue[];
}

function base(definitionId: string, versionId: string) {
  return `/admin/assessments/${definitionId}/versions/${versionId}/interpretation-sets`;
}

export function listInterpretationSets(
  definitionId: string,
  versionId: string,
): Promise<InterpretationSetSummary[]> {
  return apiRequest<InterpretationSetSummary[]>(base(definitionId, versionId));
}

export function createInterpretationSet(
  definitionId: string,
  versionId: string,
  input: { version: string; name: string; description?: string; sourceReference?: string },
): Promise<InterpretationSetSummary> {
  return apiRequest<InterpretationSetSummary>(base(definitionId, versionId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getInterpretationSet(
  definitionId: string,
  versionId: string,
  interpretationSetId: string,
): Promise<InterpretationSetDetail> {
  return apiRequest<InterpretationSetDetail>(
    `${base(definitionId, versionId)}/${interpretationSetId}`,
  );
}

export function createInterpretationRule(
  definitionId: string,
  versionId: string,
  interpretationSetId: string,
  input: {
    assessmentConstructId: string;
    code: string;
    metric: InterpretationMetric;
    lowerBound?: number;
    upperBound?: number;
    lowerInclusive?: boolean;
    upperInclusive?: boolean;
    priority?: number;
    outputData?: Record<string, unknown>;
  },
): Promise<InterpretationRule> {
  return apiRequest<InterpretationRule>(
    `${base(definitionId, versionId)}/${interpretationSetId}/rules`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getInterpretationSetPublicationReadiness(
  definitionId: string,
  versionId: string,
  interpretationSetId: string,
): Promise<InterpretationPublicationReadiness> {
  return apiRequest<InterpretationPublicationReadiness>(
    `${base(definitionId, versionId)}/${interpretationSetId}/publication-readiness`,
  );
}

export function publishInterpretationSet(
  definitionId: string,
  versionId: string,
  interpretationSetId: string,
): Promise<InterpretationSetSummary> {
  return apiRequest<InterpretationSetSummary>(
    `${base(definitionId, versionId)}/${interpretationSetId}/publish`,
    { method: "POST" },
  );
}

export function retireInterpretationSet(
  definitionId: string,
  versionId: string,
  interpretationSetId: string,
): Promise<InterpretationSetSummary> {
  return apiRequest<InterpretationSetSummary>(
    `${base(definitionId, versionId)}/${interpretationSetId}/retire`,
    { method: "POST" },
  );
}
