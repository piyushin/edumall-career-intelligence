import { API_BASE_URL, apiRequest } from "./api";

export type ReportReleaseStatus = "PENDING_REVIEW" | "RELEASED" | "WITHDRAWN";

export interface ReportReleaseListItem {
  id: string;
  attemptId: string;
  status: ReportReleaseStatus;
  reviewedAt: string | null;
  releasedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  attempt: {
    id: string;
    submittedAt: string | null;
    assignment: {
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };
      assessmentVersion: {
        id: string;
        title: string;
        versionNumber: number;
        edition: string;
        form: string;
        language: string;
      };
    };
  };
}

export interface ReportReleaseNote {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface ReportReleaseDetail extends ReportReleaseListItem {
  reportDataSnapshot: {
    id: string;
    reportVersion: string;
    generatedAt: string;
    payload: {
      assessment: {
        title: string;
        edition: string;
        form: string;
        language: string;
      };
      scoring: {
        constructs: Array<{
          assessmentConstructId: string;
          code: string;
          name: string;
          rawScore: string;
          answeredItemCount: number;
          contributionCount: number;
        }>;
      };
      norms: Array<{
        assessmentConstructId: string;
        standardizedScore: string | null;
        percentile: string | null;
      }>;
      interpretation: {
        applications: Array<{
          assessmentConstructId: string;
          ruleCode: string;
          outputData: unknown;
        }>;
      };
    };
  };
  notes: ReportReleaseNote[];
}

function organizationQuery(organizationId?: string, status?: ReportReleaseStatus): string {
  const params = new URLSearchParams();

  if (organizationId) {
    params.set("organizationId", organizationId);
  }

  if (status) {
    params.set("status", status);
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export function listReportReleases(
  organizationId?: string,
  status?: ReportReleaseStatus,
): Promise<ReportReleaseListItem[]> {
  return apiRequest<ReportReleaseListItem[]>(
    `/report-reviews${organizationQuery(organizationId, status)}`,
  );
}

export function getReportReleaseDetail(attemptId: string): Promise<ReportReleaseDetail> {
  return apiRequest<ReportReleaseDetail>(`/report-reviews/${attemptId}`);
}

export function releaseReport(attemptId: string): Promise<ReportReleaseListItem> {
  return apiRequest<ReportReleaseListItem>(`/report-reviews/${attemptId}/release`, {
    method: "POST",
  });
}

export function withdrawReport(attemptId: string, reason: string): Promise<ReportReleaseListItem> {
  return apiRequest<ReportReleaseListItem>(`/report-reviews/${attemptId}/withdraw`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function addCounsellorNote(attemptId: string, body: string): Promise<ReportReleaseNote> {
  return apiRequest<ReportReleaseNote>(`/report-reviews/${attemptId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function getReportReviewPdfUrl(attemptId: string): string {
  return `${API_BASE_URL}/report-reviews/${attemptId}/pdf`;
}
