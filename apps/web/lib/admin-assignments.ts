import { apiRequest } from "./api";

export type AdminAssignmentStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";
export type AdminAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";

export interface EligibleAssessmentCandidate {
  membershipId: string;
  role: "STUDENT" | "EMPLOYEE";
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

export interface AdminAssessmentAttempt {
  id: string;
  attemptNumber: number;
  status: AdminAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  abandonedAt: string | null;
}

export interface AdminAssessmentAssignment {
  id: string;
  organizationId: string;
  status: AdminAssignmentStatus;
  maxAttempts: number;
  availableFrom: string | null;
  expiresAt: string | null;
  assignedAt: string;
  cancelledAt: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  assessmentVersion: {
    id: string;
    versionNumber: number;
    status: string;
    title: string;
    edition: string;
    form: string;
    language: string;
    assessmentDefinition: {
      id: string;
      code: string;
      organizationId: string | null;
    };
  };
  attempts: AdminAssessmentAttempt[];
}

export interface CreateAdminAssessmentAssignmentInput {
  organizationId?: string;
  assessmentVersionId: string;
  userId: string;
  maxAttempts?: number;
  availableFrom?: string;
  expiresAt?: string;
}

function organizationQuery(organizationId?: string): string {
  if (!organizationId) {
    return "";
  }

  return `?organizationId=${encodeURIComponent(organizationId)}`;
}

export function listAdminAssessmentAssignments(
  organizationId?: string,
): Promise<AdminAssessmentAssignment[]> {
  return apiRequest<AdminAssessmentAssignment[]>(
    `/admin/assessment-assignments${organizationQuery(organizationId)}`,
  );
}

export function listEligibleAssessmentCandidates(
  organizationId?: string,
): Promise<EligibleAssessmentCandidate[]> {
  return apiRequest<EligibleAssessmentCandidate[]>(
    `/admin/assessment-assignments/candidates${organizationQuery(organizationId)}`,
  );
}

export function createAdminAssessmentAssignment(
  input: CreateAdminAssessmentAssignmentInput,
): Promise<AdminAssessmentAssignment> {
  return apiRequest<AdminAssessmentAssignment>("/admin/assessment-assignments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelAdminAssessmentAssignment(
  assignmentId: string,
): Promise<Pick<AdminAssessmentAssignment, "id" | "organizationId" | "status" | "cancelledAt">> {
  return apiRequest(`/admin/assessment-assignments/${assignmentId}/cancel`, {
    method: "POST",
  });
}
