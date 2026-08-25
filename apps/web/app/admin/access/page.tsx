"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { PlatformRoute } from "../../../components/admin-route";
import { useAdminSession } from "../../../components/admin-session";
import {
  Alert,
  ConfirmDialog,
  CursorPagination,
  EmptyState,
  ErrorState,
  Field,
  LoadingSkeleton,
  Modal,
  PageHeader,
  Panel,
  StatusBadge,
  inputClass,
} from "../../../components/admin-ui";
import { canAccessGlobalRoute, hasPermission } from "../../../lib/admin-authorization";
import { ApiError } from "../../../lib/api";
import {
  platformAdminApi,
  type AdminSummary,
  type CursorPage,
  type RoleTemplate,
} from "../../../lib/platform-admin";

interface PendingAction {
  admin: AdminSummary;
  action: "suspend" | "reactivate" | "resend" | "revoke";
}

export default function AdministratorsPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "admin.view");
  const [page, setPage] = useState<CursorPage<AdminSummary> | null>(null);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scopeType, setScopeType] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "", scopeType: "" });
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!authorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPage(
        await platformAdminApi.admins({
          search: appliedFilters.search || undefined,
          status: appliedFilters.status || undefined,
          scopeType: appliedFilters.scopeType || undefined,
          cursor,
          limit: "25",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Administrators could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, authorized, cursor]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!authorized || !hasPermission(session, "admin.create")) return;
    platformAdminApi
      .roles({ isActive: "true", limit: "100" })
      .then((result) => setRoles(result.items))
      .catch(() => setRoles([]));
  }, [authorized, session]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setHistory([]);
    setCursor(undefined);
    setAppliedFilters({ search: search.trim(), status, scopeType });
  }
  async function executeAction() {
    if (!pending) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (pending.action === "suspend" || pending.action === "reactivate")
        await platformAdminApi.adminAction(pending.admin.id, pending.action);
      else if (pending.action === "resend") {
        const result = await platformAdminApi.resendInvitation(pending.admin.id);
        setNotice(
          result.deliveryStatus === "BLOCKED_CONFIGURATION"
            ? "Invitation created — email delivery is not configured."
            : `Invitation delivery state: ${result.deliveryStatus}.`,
        );
      } else await platformAdminApi.revokeInvitation(pending.admin.id);
      if (pending.action !== "resend") setNotice(`Administrator ${pending.action} completed.`);
      setPending(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformRoute permission="admin.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="People & access"
          title="Administrators"
          description="Invite and govern delegated administrators without changing unrelated user memberships or sessions."
          actions={
            hasPermission(session, "admin.create") ? (
              <Button onClick={() => setCreateOpen(true)}>Invite administrator</Button>
            ) : undefined
          }
        />
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <Panel>
          <form
            onSubmit={applyFilters}
            className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
          >
            <Field label="Search">
              <input
                className={inputClass}
                maxLength={160}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email or responsibility"
              />
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option>ACTIVE</option>
                <option>SUSPENDED</option>
              </select>
            </Field>
            <Field label="Scope">
              <select
                className={inputClass}
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
              >
                <option value="">All scopes</option>
                <option>PLATFORM</option>
                <option>ORGANIZATION</option>
              </select>
            </Field>
            <Button className="self-end" type="submit">
              Apply filters
            </Button>
          </form>
        </Panel>
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : !page?.items.length ? (
          <EmptyState
            title="No administrators found"
            description="Adjust the filters or invite an authorized administrator."
          />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Administrator</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Responsibility</th>
                    <th className="px-5 py-3">Scope & roles</th>
                    <th className="px-5 py-3">Invitation</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {page.items.map((admin) => (
                    <tr key={admin.id} className="align-top">
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold text-red-700 hover:underline"
                          href={`/admin/access/${admin.id}`}
                        >
                          {admin.user.firstName} {admin.user.lastName}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{admin.user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={admin.status} />
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {admin.responsibility ?? admin.title ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {admin.assignments.slice(0, 3).map((assignment) => (
                            <p key={assignment.id} className="text-xs">
                              <strong>{assignment.roleTemplate.name}</strong> ·{" "}
                              {assignment.scopeType === "PLATFORM"
                                ? "Platform"
                                : (assignment.organization?.name ?? "Organization")}
                            </p>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {admin.effectivePermissions.length} effective permissions
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {admin.invitation ? (
                          <>
                            <StatusBadge value={admin.invitation.lifecycleStatus} />
                            {admin.invitation.deliveries?.[0]?.status ===
                            "BLOCKED_CONFIGURATION" ? (
                              <p className="mt-2 max-w-48 text-xs text-amber-700">
                                Email delivery is not configured.
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/access/${admin.id}`}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            Open
                          </Link>
                          {hasPermission(session, "admin.suspend") ? (
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                              onClick={() =>
                                setPending({
                                  admin,
                                  action: admin.status === "SUSPENDED" ? "reactivate" : "suspend",
                                })
                              }
                            >
                              {admin.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                            </button>
                          ) : null}
                          {admin.invitation?.lifecycleStatus === "PENDING" &&
                          hasPermission(session, "admin.create") ? (
                            <>
                              <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                                onClick={() => setPending({ admin, action: "resend" })}
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                                onClick={() => setPending({ admin, action: "revoke" })}
                              >
                                Revoke
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-5">
              <CursorPagination
                canGoBack={history.length > 0}
                hasNext={page.pageInfo.hasNext}
                onBack={() => {
                  const next = [...history];
                  setCursor(next.pop());
                  setHistory(next);
                }}
                onNext={() => {
                  setHistory((values) => [...values, cursor]);
                  setCursor(page.pageInfo.nextCursor ?? undefined);
                }}
              />
            </div>
          </Panel>
        )}
        <CreateAdminModal
          open={createOpen}
          roles={roles}
          onClose={() => setCreateOpen(false)}
          onCreated={async (message) => {
            setCreateOpen(false);
            setNotice(message);
            await load();
          }}
        />
        <ConfirmDialog
          open={Boolean(pending)}
          title={
            pending
              ? `${pending.action[0]?.toUpperCase()}${pending.action.slice(1)} administrator?`
              : "Confirm action"
          }
          impact={
            pending?.action === "suspend"
              ? "Administrative privilege sessions will be revoked. Unrelated employee or candidate sessions remain valid."
              : pending?.action === "revoke"
                ? "The active invitation and pending delivery work will be cancelled."
                : pending?.action === "resend"
                  ? "The existing invitation will be revoked and replaced. Delivery may remain blocked until email is configured."
                  : "Administrative access will become active again; no unrelated session is created."
          }
          confirmLabel={pending?.action === "resend" ? "Create replacement invitation" : "Confirm"}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void executeAction()}
        />
      </div>
    </PlatformRoute>
  );
}

function CreateAdminModal({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean;
  roles: RoleTemplate[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [responsibility, setResponsibility] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [scope, setScope] = useState<"PLATFORM" | "ORGANIZATION">("PLATFORM");
  const [organizations, setOrganizations] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = (await platformAdminApi.createAdmin({
        email,
        firstName,
        lastName,
        responsibility: responsibility.trim() || undefined,
        roleTemplateCode: roleCode,
        scopeType: scope,
        ...(scope === "ORGANIZATION"
          ? {
              organizationIds: organizations
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean),
            }
          : {}),
      })) as { invitation?: { deliveryStatus?: string } };
      setEmail("");
      setFirstName("");
      setLastName("");
      setResponsibility("");
      onCreated(
        result.invitation?.deliveryStatus === "BLOCKED_CONFIGURATION"
          ? "Invitation created — email delivery is not configured."
          : "Administrator created. Delivery status is shown in the directory.",
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Administrator could not be created.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      title="Invite administrator"
      description="Create a delegated administrative profile and explicit responsibility assignment."
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error ? (
          <div className="sm:col-span-2">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Field label="First name">
          <input
            required
            maxLength={100}
            className={inputClass}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </Field>
        <Field label="Last name">
          <input
            required
            maxLength={100}
            className={inputClass}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email">
            <input
              required
              type="email"
              maxLength={320}
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Responsibility">
          <input
            maxLength={200}
            className={inputClass}
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value)}
          />
        </Field>
        <Field label="Role template">
          <select
            required
            className={inputClass}
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
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
            value={scope}
            onChange={(e) => setScope(e.target.value as "PLATFORM" | "ORGANIZATION")}
          >
            <option value="PLATFORM">Platform</option>
            <option value="ORGANIZATION">Organization</option>
          </select>
        </Field>
        {scope === "ORGANIZATION" ? (
          <Field
            label="Organization UUIDs"
            hint="Comma-separated; each must already exist and be active."
          >
            <input
              required
              className={inputClass}
              value={organizations}
              onChange={(e) => setOrganizations(e.target.value)}
            />
          </Field>
        ) : (
          <div />
        )}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !roleCode}>
            {busy ? "Creating…" : "Create invitation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
