import { apiRequest } from "./api";

export interface PageInfo {
  hasNext: boolean;
  nextCursor: string | null;
}

export interface CursorPage<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface DashboardSummary {
  generatedAt: string;
  users: { total: number; active: number };
  organizations: { total: number; active: number };
  administrators: { platformSuperAdmins: number; delegatedActive: number };
  candidates?: { total: number };
  assessments?: {
    definitions: number;
    assignments: number;
    attempts: { inProgress: number; submitted: number; abandoned: number };
    reports: { generated: number; processing: number };
  };
  commerce?: {
    orders: number;
    paidOrders: number;
    capturedPayments: number;
    activeEntitlements: number;
  };
  recentActivity?: AuditEntry[];
}

export interface InvitationDelivery {
  id?: string;
  status?: string;
  failureCode?: string | null;
  requestedAt?: string;
  sentAt?: string | null;
  cancelledAt?: string | null;
}

export interface InvitationState {
  id: string;
  createdAt?: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  lifecycleStatus: string;
  deliveries?: InvitationDelivery[];
}

export interface InvitationIssueResult {
  id: string;
  expiresAt: string;
  deliveryStatus: string;
}

export interface AdminAssignment {
  id: string;
  scopeType: "PLATFORM" | "ORGANIZATION";
  organizationId: string | null;
  grantedAt?: string;
  revokedAt?: string | null;
  roleTemplate: {
    id?: string;
    code: string;
    name: string;
    isSystem?: boolean;
    isActive?: boolean;
    permissions?: Array<{ permission: Permission }>;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status?: string;
  } | null;
}

export interface AdminSummary {
  id: string;
  status: string;
  title: string | null;
  responsibility: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    emailVerifiedAt?: string | null;
    lastLoginAt: string | null;
    invitationTokens?: InvitationState[];
  };
  assignments: AdminAssignment[];
  effectivePermissions: string[];
  invitation: InvitationState | null;
}

export interface Permission {
  id?: string;
  code: string;
  module: string;
  action: string;
  description: string;
  createdAt?: string;
}

export interface RoleTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: { assignments: number };
  permissions: Array<{ permission: Permission }>;
}

export interface AuditEntry {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  subjectUserId?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  purpose: string | null;
  outcome: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actorUser?: { id: string; email: string; firstName: string; lastName: string } | null;
  organization?: { id: string; name: string; slug: string; type: string } | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  memberCount?: number;
  activeMemberCount: number;
  administratorCount: number;
  _count?: { memberships: number; assessmentAssignments: number; commerceOrders: number };
}

export interface UserSummary {
  id: string;
  email: string;
  phoneE164: string | null;
  firstName: string;
  lastName: string;
  status: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
  candidateSegment?: string | null;
  memberships: Array<{
    id: string;
    role: string;
    status: string;
    createdAt?: string;
    organization: { id: string; name: string; slug: string; type: string; status?: string };
  }>;
  _count?: { assignedAssessments: number; commerceOrders?: number; commerceEntitlements?: number };
  adminProfile?: {
    id: string;
    status: string;
    title: string | null;
    responsibility: string | null;
    assignments: AdminAssignment[];
  } | null;
  assignedAssessments?: Array<{
    id: string;
    status: string;
    assignedAt: string;
    organizationId: string;
    assessmentVersion: {
      id: string;
      title: string;
      versionNumber: number;
      assessmentDefinition: { id: string; code: string };
    };
    attempts: Array<{
      id: string;
      status: string;
      startedAt: string;
      submittedAt: string | null;
      reportGeneration?: {
        status: string;
        attemptCount: number;
        lastErrorCode: string | null;
        lastErrorMessage: string | null;
        completedAt: string | null;
        reportDataSnapshotId: string | null;
      } | null;
      commerceEntitlements?: Array<{
        id: string;
        status: string;
        source?: string;
        grantedAt: string;
        expiresAt: string | null;
      }>;
      reportAccessGrants?: Array<{
        id: string;
        principalType: string;
        status: string;
        source: string;
        grantedAt: string;
        expiresAt: string | null;
        principalUser: { id: string; firstName: string; lastName: string; email: string } | null;
        principalOrganization: { id: string; name: string } | null;
      }>;
      reportReleases?: Array<{ id: string; reviewedAt: string; releasedAt: string }>;
    }>;
  }>;
  candidateCounsellorAssignments?: Array<{
    id: string;
    status: string;
    assignedAt: string;
    consentedAt: string | null;
    organization: { id: string; name: string };
    counsellorUser: { id: string; firstName: string; lastName: string; email: string };
  }>;
  commerceOrders?: Array<{
    id: string;
    organizationId: string | null;
    status: string;
    totalMinor: number;
    currency: string;
    couponCodeSnapshot: string | null;
    createdAt: string;
    paidAt: string | null;
    payments: Array<{
      id: string;
      provider: string;
      method: string;
      status: string;
      amountMinor: number;
      currency: string;
      createdAt: string;
      completedAt: string | null;
    }>;
  }>;
  commerceEntitlements?: Array<{
    id: string;
    organizationId: string | null;
    type: string;
    status: string;
    grantedAt: string;
    expiresAt: string | null;
  }>;
}

function queryString(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export const platformAdminApi = {
  dashboard: () => apiRequest<DashboardSummary>("/admin/platform/dashboard"),
  admins: (query: Record<string, string | undefined>) =>
    apiRequest<CursorPage<AdminSummary>>(`/admin/platform/admins${queryString(query)}`),
  admin: (id: string) =>
    apiRequest<AdminSummary>(`/admin/platform/admins/${encodeURIComponent(id)}`),
  createAdmin: (body: unknown) =>
    apiRequest("/admin/platform/admins", { method: "POST", body: JSON.stringify(body) }),
  updateAdmin: (id: string, body: unknown) =>
    apiRequest(`/admin/platform/admins/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminAction: (id: string, action: "suspend" | "reactivate") =>
    apiRequest(`/admin/platform/admins/${encodeURIComponent(id)}/${action}`, { method: "POST" }),
  resendInvitation: (id: string) =>
    apiRequest<InvitationIssueResult>(
      `/admin/platform/admins/${encodeURIComponent(id)}/invitation/resend`,
      { method: "POST" },
    ),
  revokeInvitation: (id: string) =>
    apiRequest(`/admin/platform/admins/${encodeURIComponent(id)}/invitation/revoke`, {
      method: "POST",
    }),
  assignRole: (id: string, body: unknown) =>
    apiRequest(`/admin/platform/admins/${encodeURIComponent(id)}/assignments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revokeAssignment: (id: string) =>
    apiRequest(`/admin/platform/assignments/${encodeURIComponent(id)}/revoke`, { method: "POST" }),
  roles: (query: Record<string, string | undefined> = {}) =>
    apiRequest<CursorPage<RoleTemplate>>(`/admin/platform/role-templates${queryString(query)}`),
  permissions: (query: Record<string, string | undefined> = {}) =>
    apiRequest<CursorPage<Permission>>(`/admin/platform/permissions${queryString(query)}`),
  createRole: (body: unknown) =>
    apiRequest("/admin/platform/role-templates", { method: "POST", body: JSON.stringify(body) }),
  updateRole: (id: string, body: unknown) =>
    apiRequest(`/admin/platform/role-templates/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  replaceRolePermissions: (id: string, permissionCodes: string[]) =>
    apiRequest(`/admin/platform/role-templates/${encodeURIComponent(id)}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissionCodes }),
    }),
  roleAction: (id: string, action: "activate" | "deactivate") =>
    apiRequest(`/admin/platform/role-templates/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
    }),
  audit: (query: Record<string, string | undefined>) =>
    apiRequest<CursorPage<AuditEntry>>(`/admin/platform/audit${queryString(query)}`),
  organizations: (query: Record<string, string | undefined>) =>
    apiRequest<CursorPage<OrganizationSummary>>(
      `/admin/platform/organizations${queryString(query)}`,
    ),
  organization: (id: string) =>
    apiRequest<OrganizationSummary>(`/admin/platform/organizations/${encodeURIComponent(id)}`),
  users: (query: Record<string, string | undefined>) =>
    apiRequest<CursorPage<UserSummary>>(`/admin/platform/users${queryString(query)}`),
  user: (id: string) => apiRequest<UserSummary>(`/admin/platform/users/${encodeURIComponent(id)}`),
};
