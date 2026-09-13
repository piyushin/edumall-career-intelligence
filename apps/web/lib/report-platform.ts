import { API_BASE_URL, ApiError, apiRequest } from "./api";
import type { AssessmentReportPayload } from "./assessment-results";

export type ReportGenerationStatus =
  "PENDING" | "PROCESSING" | "GENERATED" | "BLOCKED_CONFIGURATION" | "FAILED";

export interface ReportSearchItem {
  attemptId: string;
  attemptNumber: number;
  submittedAt: string | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneE164: string | null;
  };
  organization: { id: string; name: string };
  assessment: {
    id: string;
    title: string;
    versionNumber: number;
    assessmentDefinition: { id: string; code: string };
  };
  generationStatus: ReportGenerationStatus | null;
  generation: {
    status: ReportGenerationStatus;
    attemptCount: number;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    configurationId: string | null;
    completedAt: string | null;
  } | null;
  candidateEntitlementStatus: string;
  counsellors: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  thirdPartyAccess: {
    activeGrantCount: number;
    organizationAccess: boolean;
    counsellorAccess: boolean;
  };
  canViewFullReport: boolean;
  canDownloadReport: boolean;
  canRetryGeneration: boolean;
}

export interface ReportSearchPage {
  items: ReportSearchItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface OpenedReport {
  attemptId: string;
  generationStatus: ReportGenerationStatus | null;
  report: {
    id: string;
    reportVersion: string;
    generatedAt: string;
    payload: AssessmentReportPayload;
  };
}

function queryString(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

async function download(path: string, fallback: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { accept: "application/pdf" },
  });
  if (!response.ok) {
    let body: { code?: string; message?: string } | undefined;
    try {
      body = (await response.json()) as typeof body;
    } catch {
      body = undefined;
    }
    throw new ApiError(response.status, body);
  }
  const disposition = response.headers.get("content-disposition");
  return {
    blob: await response.blob(),
    filename: disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback,
  };
}

export const reportPlatformApi = {
  adminList: (query: Record<string, string | undefined>) =>
    apiRequest<ReportSearchPage>(`/admin/reports${queryString(query)}`),
  adminDetail: (attemptId: string) =>
    apiRequest<ReportSearchItem>(`/admin/reports/${encodeURIComponent(attemptId)}`),
  adminFull: (attemptId: string) =>
    apiRequest<OpenedReport>(`/admin/reports/${encodeURIComponent(attemptId)}/full`),
  adminRetry: (attemptId: string) =>
    apiRequest(`/admin/reports/${encodeURIComponent(attemptId)}/retry`, { method: "POST" }),
  adminPdf: (attemptId: string) =>
    download(
      `/admin/reports/${encodeURIComponent(attemptId)}/report.pdf`,
      `career-intelligence-report-${attemptId}.pdf`,
    ),
  staffList: (query: Record<string, string | undefined>) =>
    apiRequest<ReportSearchPage>(`/staff/reports${queryString(query)}`),
  staffDetail: (attemptId: string) =>
    apiRequest<ReportSearchItem>(`/staff/reports/${encodeURIComponent(attemptId)}`),
  staffFull: (attemptId: string) =>
    apiRequest<OpenedReport>(`/staff/reports/${encodeURIComponent(attemptId)}/full`),
};
