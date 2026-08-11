import { apiRequest } from "./api";

export type AssessmentAssignmentStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";
export type AssessmentAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";

export type AssessmentItemType =
  "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "LIKERT" | "BOOLEAN" | "NUMERIC" | "TEXT";

export interface CandidateAttemptSummary {
  id: string;
  attemptNumber: number;
  status: AssessmentAttemptStatus;
  startedAt: string;
  lastActivityAt: string;
  submittedAt: string | null;
  abandonedAt: string | null;
}

export interface CandidateAssignment {
  id: string;
  assignedAt: string;
  availableFrom: string | null;
  expiresAt: string | null;
  maxAttempts: number;
  status: AssessmentAssignmentStatus;
  assessmentVersion: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    versionNumber: number;
    edition: string;
    form: string;
    language: string;
  };
  attempts: CandidateAttemptSummary[];
}

export interface CandidateAssessmentOption {
  id: string;
  code: string;
  label: string;
  orderIndex: number;
}

export interface CandidateAssessmentItem {
  id: string;
  code: string;
  type: AssessmentItemType;
  prompt: string;
  helpText: string | null;
  orderIndex: number;
  required: boolean;
  options: CandidateAssessmentOption[];
}

export interface CandidateAssessmentResponse {
  id: string;
  itemId: string;
  textValue: string | null;
  numericValue: string | null;
  booleanValue: boolean | null;
  answeredAt: string;
  updatedAt: string;
  optionIds: string[];
}

export interface CandidateAttempt {
  id: string;
  attemptNumber: number;
  status: AssessmentAttemptStatus;
  startedAt: string;
  lastActivityAt: string;
  submittedAt: string | null;
  assignment: {
    id: string;
    assessmentVersion: {
      id: string;
      title: string;
      description: string | null;
      instructions: string | null;
      versionNumber: number;
      edition: string;
      form: string;
      language: string;
      items: CandidateAssessmentItem[];
    };
  };
  responses: CandidateAssessmentResponse[];
}

export interface SaveCandidateResponse {
  textValue?: string;
  numericValue?: number;
  booleanValue?: boolean;
  optionIds?: string[];
}

export function listCandidateAssignments(): Promise<CandidateAssignment[]> {
  return apiRequest<CandidateAssignment[]>("/assessments/assignments");
}

export function startOrResumeCandidateAttempt(
  assignmentId: string,
): Promise<CandidateAttemptSummary> {
  return apiRequest<CandidateAttemptSummary>(`/assessments/assignments/${assignmentId}/attempts`, {
    method: "POST",
  });
}

export function getCandidateAttempt(attemptId: string): Promise<CandidateAttempt> {
  return apiRequest<CandidateAttempt>(`/assessments/attempts/${attemptId}`);
}

export function saveCandidateResponse(
  attemptId: string,
  itemId: string,
  response: SaveCandidateResponse,
): Promise<{ status: "saved"; responseId: string }> {
  return apiRequest<{ status: "saved"; responseId: string }>(
    `/assessments/attempts/${attemptId}/responses/${itemId}`,
    {
      method: "PUT",
      body: JSON.stringify(response),
    },
  );
}

export function submitCandidateAttempt(
  attemptId: string,
): Promise<{ status: "submitted"; submittedAt: string | null }> {
  return apiRequest<{ status: "submitted"; submittedAt: string | null }>(
    `/assessments/attempts/${attemptId}/submit`,
    {
      method: "POST",
    },
  );
}
