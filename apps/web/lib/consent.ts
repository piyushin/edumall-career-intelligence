import { apiRequest } from "./api";

export type ConsentDocumentType = "PRIVACY_NOTICE" | "ASSESSMENT_DATA_PROCESSING";
export type ConsentAcceptorRole = "SELF" | "GUARDIAN" | "STUDENT_ASSENT";

export interface ConsentRequirementItem {
  documentType: ConsentDocumentType;
  role: ConsentAcceptorRole;
  documentId: string | null;
  documentVersion: string | null;
  documentTitle: string | null;
  documentBodyText: string | null;
  satisfied: boolean;
}

export interface ConsentRequirements {
  dateOfBirthRequired: boolean;
  dateOfBirth: string | null;
  isMinor: boolean | null;
  requirements: ConsentRequirementItem[];
  complete: boolean;
}

export function getConsentRequirements(): Promise<ConsentRequirements> {
  return apiRequest<ConsentRequirements>("/consent/requirements");
}

export function recordDateOfBirth(dateOfBirth: string): Promise<ConsentRequirements> {
  return apiRequest<ConsentRequirements>("/consent/date-of-birth", {
    method: "POST",
    body: JSON.stringify({ dateOfBirth }),
  });
}

export function acceptConsentDocument(input: {
  consentDocumentId: string;
  acceptedByRole: ConsentAcceptorRole;
  guardianName?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
}): Promise<ConsentRequirements> {
  return apiRequest<ConsentRequirements>("/consent/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
