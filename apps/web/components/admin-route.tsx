"use client";

import type { ReactNode } from "react";
import { canAccessGlobalRoute, hasPermission } from "../lib/admin-authorization";
import { useAdminSession } from "./admin-session";
import { Alert } from "./admin-ui";

export function PlatformRoute({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const session = useAdminSession();
  if (!canAccessGlobalRoute(session, permission))
    return (
      <Alert tone="warning">
        <strong>Access denied.</strong> Your current server-validated session does not authorize
        this platform workspace.
      </Alert>
    );
  return <>{children}</>;
}

export function AdminRoute({
  permission,
  permissions,
  children,
}: {
  permission?: string;
  permissions?: string[];
  children: ReactNode;
}) {
  const session = useAdminSession();
  const required = permissions ?? (permission ? [permission] : []);
  if (!required.length || !required.every((value) => hasPermission(session, value)))
    return (
      <Alert tone="warning">
        <strong>Access denied.</strong> Your current server-validated session does not authorize
        this administrative workspace.
      </Alert>
    );
  return <>{children}</>;
}
