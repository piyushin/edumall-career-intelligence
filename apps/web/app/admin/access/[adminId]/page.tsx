"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { PlatformRoute } from "../../../../components/admin-route";
import { useAdminSession } from "../../../../components/admin-session";
import {
  Alert,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
  inputClass,
} from "../../../../components/admin-ui";
import { canAccessGlobalRoute, hasPermission } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import {
  platformAdminApi,
  type AdminSummary,
  type AuditEntry,
  type RoleTemplate,
} from "../../../../lib/platform-admin";

export default function AdministratorDetailPage() {
  const params = useParams<{ adminId: string }>();
  const adminId = params.adminId;
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "admin.view");
  const [admin, setAdmin] = useState<AdminSummary | null>(null);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<
    "suspend" | "reactivate" | "resend-invitation" | "revoke-invitation" | null
  >(null);
  const [revokeAssignmentId, setRevokeAssignmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!authorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const detail = await platformAdminApi.admin(adminId);
      setAdmin(detail);
      const tasks: Promise<unknown>[] = [];
      if (hasPermission(session, "admin.permission.manage"))
        tasks.push(
          platformAdminApi
            .roles({ isActive: "true", limit: "100" })
            .then((value) => setRoles(value.items)),
        );
      if (hasPermission(session, "audit.view"))
        tasks.push(
          platformAdminApi
            .audit({
              subjectUserId: detail.user.id,
              limit: "10",
              purpose: "administrator_support_review",
            })
            .then((value) => setAudit(value.items)),
        );
      await Promise.all(tasks);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Administrator detail could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [adminId, authorized, session]);
  useEffect(() => {
    void load();
  }, [load]);
  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    try {
      let resultNotice: string;
      if (confirm === "revoke-invitation") {
        await platformAdminApi.revokeInvitation(adminId);
        resultNotice = "Invitation revoked.";
      } else if (confirm === "resend-invitation") {
        const result = await platformAdminApi.resendInvitation(adminId);
        resultNotice =
          result.deliveryStatus === "BLOCKED_CONFIGURATION"
            ? "Replacement invitation created — email delivery is not configured."
            : `Invitation delivery state: ${result.deliveryStatus}`;
      } else {
        await platformAdminApi.adminAction(adminId, confirm);
        resultNotice =
          confirm === "suspend"
            ? "Administrative access suspended. Unrelated user sessions were preserved."
            : "Administrative access reactivated.";
      }
      setNotice(resultNotice);
      setConfirm(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <PlatformRoute permission="admin.view">
        <LoadingSkeleton rows={8} />
      </PlatformRoute>
    );
  if (error && !admin)
    return (
      <PlatformRoute permission="admin.view">
        <ErrorState message={error} retry={() => void load()} />
      </PlatformRoute>
    );
  if (!admin)
    return (
      <PlatformRoute permission="admin.view">
        <EmptyState
          title="Administrator not found"
          description="The requested administrator profile is unavailable."
        />
      </PlatformRoute>
    );

  const invitation = admin.user.invitationTokens?.[0] ?? admin.invitation;
  return (
    <PlatformRoute permission="admin.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Administrator detail"
          title={`${admin.user.firstName} ${admin.user.lastName}`}
          description={`${admin.user.email} · Created ${formatDate(admin.createdAt)}`}
          actions={
            hasPermission(session, "admin.suspend") ? (
              <Button
                variant="secondary"
                onClick={() => setConfirm(admin.status === "SUSPENDED" ? "reactivate" : "suspend")}
              >
                {admin.status === "SUSPENDED" ? "Reactivate" : "Suspend access"}
              </Button>
            ) : undefined
          }
        />
        {error ? <Alert>{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel>
            <h2 className="text-sm font-semibold text-slate-500">Administrative status</h2>
            <div className="mt-3">
              <StatusBadge value={admin.status} />
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Account</dt>
                <dd className="font-medium text-slate-900">{admin.user.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Title</dt>
                <dd className="font-medium text-slate-900">{admin.title ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Responsibility</dt>
                <dd className="font-medium text-slate-900">{admin.responsibility ?? "—"}</dd>
              </div>
            </dl>
          </Panel>
          <Panel className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-500">Effective permissions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {admin.effectivePermissions.length ? (
                admin.effectivePermissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    {permission}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">No effective permissions.</p>
              )}
            </div>
          </Panel>
        </div>
        <Panel>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Role and scope assignments</h2>
              <p className="mt-1 text-sm text-slate-600">
                Platform assignments apply globally; organization assignments remain tenant-bound.
              </p>
            </div>
          </div>
          {admin.assignments.length ? (
            <div className="mt-5 divide-y divide-slate-100">
              {admin.assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium text-slate-900">{assignment.roleTemplate.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.scopeType === "PLATFORM"
                        ? "Platform-wide scope"
                        : `Organization: ${assignment.organization?.name ?? assignment.organizationId}`}
                      {assignment.revokedAt ? ` · Revoked ${formatDate(assignment.revokedAt)}` : ""}
                    </p>
                  </div>
                  {!assignment.revokedAt && hasPermission(session, "admin.permission.manage") ? (
                    <Button
                      variant="secondary"
                      onClick={() => setRevokeAssignmentId(assignment.id)}
                    >
                      Revoke assignment
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="No assignments"
                description="This administrator currently has no responsibility assignment."
              />
            </div>
          )}
          {hasPermission(session, "admin.permission.manage") ? (
            <AssignmentForm
              adminId={adminId}
              roles={roles}
              onComplete={async () => {
                setNotice("Role assignment added.");
                await load();
              }}
            />
          ) : null}
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold text-slate-950">Invitation delivery</h2>
          {invitation ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge value={invitation.lifecycleStatus} />
                {invitation.deliveries?.[0]?.status ? (
                  <StatusBadge value={invitation.deliveries[0].status} />
                ) : null}
              </div>
              {invitation.deliveries?.[0]?.status === "BLOCKED_CONFIGURATION" ? (
                <div className="mt-4">
                  <Alert tone="warning">
                    Invitation created — email delivery is not configured. Do not tell the
                    administrator that an email was sent.
                  </Alert>
                </div>
              ) : null}
              <p className="mt-3 text-sm text-slate-600">
                Expires {formatDate(invitation.expiresAt)}
              </p>
              {invitation.lifecycleStatus === "PENDING" &&
              hasPermission(session, "admin.create") ? (
                <div className="mt-4 flex gap-3">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setConfirm("resend-invitation")}
                  >
                    Resend invitation
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setConfirm("revoke-invitation")}
                  >
                    Revoke invitation
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No invitation"
                description="This administrator does not have an invitation lifecycle record."
              />
            </div>
          )}
        </Panel>
        {hasPermission(session, "audit.view") ? (
          <Panel>
            <h2 className="text-lg font-semibold text-slate-950">Relevant audit activity</h2>
            {audit.length ? (
              <div className="mt-4 divide-y divide-slate-100">
                {audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col justify-between gap-2 py-3 sm:flex-row"
                  >
                    <div>
                      <p className="text-sm font-medium">{entry.action}</p>
                      <p className="text-xs text-slate-500">
                        {entry.entityType}
                        {entry.entityId ? ` · ${entry.entityId}` : ""}
                      </p>
                    </div>
                    <time className="text-xs text-slate-500">{formatDate(entry.createdAt)}</time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No matching audit events.</p>
            )}
          </Panel>
        ) : null}
        <ConfirmDialog
          open={Boolean(confirm)}
          title="Confirm privileged action"
          impact={
            confirm === "suspend"
              ? "Privileged sessions attributed to this administrator will be revoked; unrelated legitimate sessions remain active."
              : confirm === "reactivate"
                ? "Administrative privilege will be restored according to active assignments."
                : confirm === "resend-invitation"
                  ? "The current invitation will be revoked and replaced. Delivery may remain blocked until an email provider is configured."
                  : "The current invitation and pending delivery work will be cancelled."
          }
          confirmLabel="Confirm"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runConfirmed()}
        />
        <ConfirmDialog
          open={Boolean(revokeAssignmentId)}
          title="Revoke role assignment?"
          impact="Access contributed by this role and scope will stop immediately. The historical assignment remains auditable."
          confirmLabel="Revoke assignment"
          busy={busy}
          onCancel={() => setRevokeAssignmentId(null)}
          onConfirm={async () => {
            if (!revokeAssignmentId) return;
            setBusy(true);
            try {
              await platformAdminApi.revokeAssignment(revokeAssignmentId);
              setNotice("Role assignment revoked.");
              setRevokeAssignmentId(null);
              await load();
            } catch (caught) {
              setError(
                caught instanceof ApiError ? caught.message : "Assignment could not be revoked.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </PlatformRoute>
  );
}

function AssignmentForm({
  adminId,
  roles,
  onComplete,
}: {
  adminId: string;
  roles: RoleTemplate[];
  onComplete: () => void;
}) {
  const [roleTemplateCode, setRoleTemplateCode] = useState("");
  const [scopeType, setScopeType] = useState<"PLATFORM" | "ORGANIZATION">("PLATFORM");
  const [organizationIds, setOrganizationIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await platformAdminApi.assignRole(adminId, {
        roleTemplateCode,
        scopeType,
        ...(scopeType === "ORGANIZATION"
          ? {
              organizationIds: organizationIds
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean),
            }
          : {}),
      });
      setRoleTemplateCode("");
      setOrganizationIds("");
      onComplete();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Assignment could not be created.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3"
    >
      {error ? (
        <div className="md:col-span-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <Field label="Role">
        <select
          required
          className={inputClass}
          value={roleTemplateCode}
          onChange={(e) => setRoleTemplateCode(e.target.value)}
        >
          <option value="">Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Scope">
        <select
          className={inputClass}
          value={scopeType}
          onChange={(e) => setScopeType(e.target.value as "PLATFORM" | "ORGANIZATION")}
        >
          <option>PLATFORM</option>
          <option>ORGANIZATION</option>
        </select>
      </Field>
      {scopeType === "ORGANIZATION" ? (
        <Field label="Organization UUIDs">
          <input
            required
            className={inputClass}
            value={organizationIds}
            onChange={(e) => setOrganizationIds(e.target.value)}
          />
        </Field>
      ) : (
        <div className="flex items-end">
          <p className="pb-3 text-xs text-amber-700">Platform scope applies across all tenants.</p>
        </div>
      )}
      <div className="md:col-span-3">
        <Button type="submit" disabled={busy || !roleTemplateCode}>
          {busy ? "Assigning…" : "Add assignment"}
        </Button>
      </div>
    </form>
  );
}
