import type { AuthSession, MembershipRole } from "./auth";

export type AdminPermission =
  | "admin.view"
  | "admin.create"
  | "admin.permission.manage"
  | "admin.suspend"
  | "audit.view"
  | "organization.view"
  | "candidate.view"
  | "assessment.view"
  | "assessment.manage"
  | "report.search"
  | "report.view.full"
  | "report.download"
  | "report.credit.view"
  | "report.credit.manage"
  | "report.release"
  | "commerce.view";

export function isPlatformSession(session: AuthSession | null): boolean {
  return Boolean(
    session &&
    session.session.organizationId === null &&
    (session.session.role === "SUPER_ADMIN" || session.session.role === "PLATFORM_ADMIN"),
  );
}

export function hasPermission(session: AuthSession | null, permission: string): boolean {
  if (!session) return false;
  const legacyOrganizationAdmin = new Set([
    "assessment.view",
    "assessment.manage",
    "assessment.publish",
    "candidate.view",
    "candidate.manage",
    "report.release",
    "report.search",
    "report.credit.view",
    "report.credit.manage",
    "counsellor.assignment.view",
    "counsellor.assignment.manage",
    "commerce.view",
    "commerce.product.manage",
    "commerce.price.manage",
    "commerce.coupon.manage",
    "commerce.payment.approve",
  ]);
  return (
    (session.session.role === "SUPER_ADMIN" && session.session.organizationId === null) ||
    (session.session.role === "ORGANIZATION_ADMIN" &&
      session.session.organizationId !== null &&
      legacyOrganizationAdmin.has(permission)) ||
    session.session.permissions.includes(permission)
  );
}

export function canAccessGlobalRoute(session: AuthSession | null, permission: string): boolean {
  return isPlatformSession(session) && hasPermission(session, permission);
}

export function roleLabel(role: MembershipRole): string {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

export function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}
