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
