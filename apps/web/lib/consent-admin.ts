import { apiRequest } from "./api";
import type { ConsentDocumentType } from "./consent";

export type ConsentDocumentStatus = "DRAFT" | "PUBLISHED" | "RETIRED";

export interface AdminConsentDocument {
  id: string;
  type: ConsentDocumentType;
  version: string;
  title: string;
  bodyText: string;
  status: ConsentDocumentStatus;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listConsentDocuments(): Promise<AdminConsentDocument[]> {
  return apiRequest<AdminConsentDocument[]>("/admin/consent-documents");
}

export function createConsentDocument(input: {
  type: ConsentDocumentType;
  version: string;
  title: string;
  bodyText: string;
}): Promise<AdminConsentDocument> {
  return apiRequest<AdminConsentDocument>("/admin/consent-documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function publishConsentDocument(id: string): Promise<AdminConsentDocument> {
  return apiRequest<AdminConsentDocument>(`/admin/consent-documents/${id}/publish`, {
    method: "POST",
  });
}

export function retireConsentDocument(id: string): Promise<AdminConsentDocument> {
  return apiRequest<AdminConsentDocument>(`/admin/consent-documents/${id}/retire`, {
    method: "POST",
  });
}
