import { apiRequest } from "./api";

export interface AssessmentResultSummary {
  id: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  assignment: {
    id: string;
    organizationId: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    assessmentVersion: {
      id: string;
      versionNumber: number;
      title: string;
      edition: string;
      form: string;
      language: string;
      scoringVersion: string;
      normVersion: string;
      reportVersion: string;
      assessmentDefinition: {
        id: string;
        code: string;
      };
    };
  };
  scoring: {
    id: string;
    scoringVersion: string;
    algorithmVersion: string;
    inputHash: string;
    calculatedAt: string;
    constructCount: number;
  } | null;
  reportSnapshot: {
    id: string;
    reportVersion: string;
    inputHash: string;
    generatedAt: string;
    interpretationSetId: string | null;
  } | null;
}

export interface AssessmentResultDetail extends Omit<AssessmentResultSummary, "scoring"> {
  lastActivityAt: string;
  scoring: {
    id: string;
    scoringVersion: string;
    algorithmVersion: string;
    inputHash: string;
    calculatedAt: string;
    constructs: Array<{
      assessmentConstructId: string;
      code: string;
      name: string;
      orderIndex: number;
      rawScore: string;
      answeredItemCount: number;
      contributionCount: number;
    }>;
  } | null;
}

function organizationQuery(organizationId?: string): string {
  return organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
}

export function listAssessmentResults(organizationId?: string): Promise<AssessmentResultSummary[]> {
  return apiRequest<AssessmentResultSummary[]>(
    `/staff/assessment-results${organizationQuery(organizationId)}`,
  );
}

export function getAssessmentResult(
  attemptId: string,
  organizationId?: string,
): Promise<AssessmentResultDetail> {
  return apiRequest<AssessmentResultDetail>(
    `/staff/assessment-results/${attemptId}${organizationQuery(organizationId)}`,
  );
}

export interface AssessmentReportPayload {
  schemaVersion: string;
  assessment: {
    assessmentVersionId: string;
    versionNumber: number;
    title: string;
    edition: string;
    form: string;
    language: string;
    scoringVersion: string;
    normVersion: string;
    reportVersion: string;
  };
  scoring: {
    scoringRunId: string;
    attemptId: string;
    scoringVersion: string;
    algorithmVersion: string;
    scoringInputHash: string;
    calculatedAt: string;
    constructs: Array<{
      assessmentConstructId: string;
      code: string;
      name: string;
      orderIndex: number;
      rawScore: string;
      answeredItemCount: number;
      contributionCount: number;
    }>;
  };
  norms: Array<{
    id: string;
    assessmentConstructId: string;
    normSetId: string;
    normGroupId: string;
    constructNormTableId: string;
    normLookupRowId: string;
    rawScore: string;
    standardizedScore: string | null;
    percentile: string | null;
    appliedAt: string;
  }>;
  interpretation: {
    interpretationSetId: string;
    version: string;
    name: string;
    applications: Array<{
      id: string;
      normApplicationId: string;
      interpretationRuleId: string;
      assessmentConstructId: string;
      ruleCode: string;
      metric: string;
      priority: number;
      metricValue: string;
      outputData: unknown;
      appliedAt: string;
    }>;
  };
}

export interface AssessmentReportReadiness {
  status: "SCORING_UNAVAILABLE" | "NOT_READY" | "READY" | "GENERATED";
  scoringRunId: string | null;
  publishedNormGroups: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    sampleSize: number | null;
    normSetId: string;
    normSetName: string;
    normVersion: string;
    sourceReference: string | null;
  }>;
  publishedInterpretationSets: Array<{
    id: string;
    version: string;
    name: string;
    description: string | null;
    sourceReference: string | null;
  }>;
  latestSnapshot: {
    id: string;
    scoringRunId: string;
    assessmentVersionId: string;
    interpretationSetId: string | null;
    reportVersion: string;
    inputHash: string;
    payload: AssessmentReportPayload;
    generatedAt: string;
  } | null;
  canGenerate: boolean;
}

export interface GeneratedAssessmentReportSnapshot {
  id: string;
  scoringRunId: string;
  assessmentVersionId: string;
  interpretationSetId: string | null;
  reportVersion: string;
  inputHash: string;
  payload: AssessmentReportPayload;
  generatedAt: string;
}

export function getAssessmentReportReadiness(
  attemptId: string,
  organizationId?: string,
): Promise<AssessmentReportReadiness> {
  return apiRequest<AssessmentReportReadiness>(
    `/staff/assessment-results/${attemptId}/report-readiness${organizationQuery(organizationId)}`,
  );
}

export function generateAssessmentReportSnapshot(
  attemptId: string,
  input: {
    normGroupId: string;
    interpretationSetId: string;
  },
  organizationId?: string,
): Promise<GeneratedAssessmentReportSnapshot> {
  return apiRequest<GeneratedAssessmentReportSnapshot>(
    `/staff/assessment-results/${attemptId}/report-snapshot${organizationQuery(organizationId)}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
