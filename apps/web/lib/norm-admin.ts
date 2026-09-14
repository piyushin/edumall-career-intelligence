import { apiRequest } from "./api";

export type NormSetStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export interface NormSetSummary {
  id: string;
  assessmentVersionId: string;
  normVersion: string;
  name: string;
  description: string | null;
  sourceReference: string | null;
  status: NormSetStatus;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
}

export interface NormLookupRow {
  id: string;
  rawScoreMin: number | string;
  rawScoreMax: number | string;
  standardizedScore: number | string | null;
  percentile: number | string | null;
}

export interface ConstructNormTable {
  id: string;
  assessmentConstructId: string;
  assessmentConstruct: { code: string; name: string };
  rows: NormLookupRow[];
}

export interface NormGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sampleSize: number | null;
  constructTables: ConstructNormTable[];
}

export interface NormSetDetail extends NormSetSummary {
  groups: NormGroup[];
}

export interface NormPublicationIssue {
  code: string;
  message: string;
  constructId?: string;
}

export interface NormPublicationReadiness {
  normSetId: string;
  ready: boolean;
  issues: NormPublicationIssue[];
}

function base(definitionId: string, versionId: string) {
  return `/admin/assessments/${definitionId}/versions/${versionId}/norm-sets`;
}

export function listNormSets(definitionId: string, versionId: string): Promise<NormSetSummary[]> {
  return apiRequest<NormSetSummary[]>(base(definitionId, versionId));
}

export function createNormSet(
  definitionId: string,
  versionId: string,
  input: { normVersion: string; name: string; description?: string; sourceReference?: string },
): Promise<NormSetSummary> {
  return apiRequest<NormSetSummary>(base(definitionId, versionId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getNormSet(
  definitionId: string,
  versionId: string,
  normSetId: string,
): Promise<NormSetDetail> {
  return apiRequest<NormSetDetail>(`${base(definitionId, versionId)}/${normSetId}`);
}

export function createNormGroup(
  definitionId: string,
  versionId: string,
  normSetId: string,
  input: { code: string; name: string; description?: string; sampleSize?: number },
): Promise<NormGroup> {
  return apiRequest<NormGroup>(`${base(definitionId, versionId)}/${normSetId}/groups`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createConstructNormTable(
  definitionId: string,
  versionId: string,
  normSetId: string,
  normGroupId: string,
  input: { assessmentConstructId: string },
): Promise<ConstructNormTable> {
  return apiRequest<ConstructNormTable>(
    `${base(definitionId, versionId)}/${normSetId}/groups/${normGroupId}/tables`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function createNormLookupRow(
  definitionId: string,
  versionId: string,
  normSetId: string,
  normGroupId: string,
  tableId: string,
  input: {
    rawScoreMin: number;
    rawScoreMax: number;
    standardizedScore?: number;
    percentile?: number;
  },
): Promise<NormLookupRow> {
  return apiRequest<NormLookupRow>(
    `${base(definitionId, versionId)}/${normSetId}/groups/${normGroupId}/tables/${tableId}/rows`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getNormSetPublicationReadiness(
  definitionId: string,
  versionId: string,
  normSetId: string,
): Promise<NormPublicationReadiness> {
  return apiRequest<NormPublicationReadiness>(
    `${base(definitionId, versionId)}/${normSetId}/publication-readiness`,
  );
}

export function publishNormSet(
  definitionId: string,
  versionId: string,
  normSetId: string,
): Promise<NormSetSummary> {
  return apiRequest<NormSetSummary>(`${base(definitionId, versionId)}/${normSetId}/publish`, {
    method: "POST",
  });
}

export function retireNormSet(
  definitionId: string,
  versionId: string,
  normSetId: string,
): Promise<NormSetSummary> {
  return apiRequest<NormSetSummary>(`${base(definitionId, versionId)}/${normSetId}/retire`, {
    method: "POST",
  });
}
