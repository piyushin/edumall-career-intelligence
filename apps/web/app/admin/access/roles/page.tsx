"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { PlatformRoute } from "../../../../components/admin-route";
import { useAdminSession } from "../../../../components/admin-session";
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
} from "../../../../components/admin-ui";
import { canAccessGlobalRoute, hasPermission } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import {
  platformAdminApi,
  type CursorPage,
  type Permission,
  type RoleTemplate,
} from "../../../../lib/platform-admin";

function groupPermissions(permissions: Permission[]): Array<[string, Permission[]]> {
  const groups = permissions.reduce<Record<string, Permission[]>>((result, permission) => {
    (result[permission.module] ??= []).push(permission);
    return result;
  }, {});
  return Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
}

export default function RolesPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "admin.view");
  const manageable = hasPermission(session, "admin.permission.manage");
  const [page, setPage] = useState<CursorPage<RoleTemplate> | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<RoleTemplate | "new" | null>(null);
  const [toggle, setToggle] = useState<RoleTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!authorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [roles, catalogue] = await Promise.all([
        platformAdminApi.roles({ cursor, limit: "50" }),
        platformAdminApi.permissions({ limit: "100" }),
      ]);
      setPage(roles);
      setPermissions(catalogue.items);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Roles and permissions could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorized, cursor]);
  useEffect(() => {
    void load();
  }, [load]);
  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);
  async function toggleRole() {
    if (!toggle) return;
    setBusy(true);
    try {
      await platformAdminApi.roleAction(toggle.id, toggle.isActive ? "deactivate" : "activate");
      setNotice(`${toggle.name} ${toggle.isActive ? "deactivated" : "activated"}.`);
      setToggle(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Role status could not be changed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PlatformRoute permission="admin.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Access governance"
          title="Roles & permissions"
          description="Review the six protected responsibility templates and govern custom roles without changing the system security baseline."
          actions={
            manageable ? (
              <Button onClick={() => setEditing("new")}>Create custom role</Button>
            ) : undefined
          }
        />
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {loading ? (
          <LoadingSkeleton rows={7} />
        ) : error && !page ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <>
            {error ? <Alert>{error}</Alert> : null}
            <section className="grid gap-5 xl:grid-cols-2">
              {page?.items.map((role) => (
                <Panel key={role.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">{role.name}</h2>
                        <StatusBadge value={role.isActive ? "ACTIVE" : "INACTIVE"} />
                        {role.isSystem ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                            Protected system role · read only
                          </span>
                        ) : (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            Custom role
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">{role.code}</p>
                    </div>
                    {!role.isSystem && manageable ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setEditing(role)}>
                          Edit
                        </Button>
                        <Button variant="secondary" onClick={() => setToggle(role)}>
                          {role.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {role.description ?? "No description."}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {role._count?.assignments ?? 0} active assignments
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {role.permissions.map(({ permission }) => (
                      <span
                        key={permission.code}
                        className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        {permission.code}
                      </span>
                    ))}
                  </div>
                </Panel>
              ))}
            </section>
            {!page?.items.length ? (
              <EmptyState
                title="No role templates"
                description="No role template matched this page."
              />
            ) : null}
            {page ? (
              <CursorPagination
                canGoBack={history.length > 0}
                hasNext={page.pageInfo.hasNext}
                onBack={() => {
                  const values = [...history];
                  setCursor(values.pop());
                  setHistory(values);
                }}
                onNext={() => {
                  setHistory((values) => [...values, cursor]);
                  setCursor(page.pageInfo.nextCursor ?? undefined);
                }}
              />
            ) : null}
            <Panel>
              <h2 className="text-lg font-semibold text-slate-950">Permission catalogue</h2>
              <p className="mt-1 text-sm text-slate-600">
                Permissions are grouped by their server-defined module.
              </p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {grouped.map(([module, values]) => (
                  <section key={module} className="rounded-xl border border-slate-200 p-4">
                    <h3 className="font-semibold capitalize text-slate-900">{module}</h3>
                    <ul className="mt-3 space-y-3">
                      {values?.map((permission) => (
                        <li key={permission.code}>
                          <p className="font-mono text-xs font-semibold text-slate-800">
                            {permission.code}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {permission.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </Panel>
          </>
        )}
        <RoleEditor
          open={editing !== null}
          role={editing === "new" ? null : editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setNotice("Custom role saved.");
            await load();
          }}
        />
        <ConfirmDialog
          open={Boolean(toggle)}
          title={toggle?.isActive ? "Deactivate custom role?" : "Activate custom role?"}
          impact={
            toggle?.isActive
              ? "Assignments remain recorded, but this role stops contributing effective permissions immediately."
              : "Active assignments will begin contributing this role’s permissions."
          }
          confirmLabel={toggle?.isActive ? "Deactivate" : "Activate"}
          busy={busy}
          onCancel={() => setToggle(null)}
          onConfirm={() => void toggleRole()}
        />
      </div>
    </PlatformRoute>
  );
}

function RoleEditor({
  open,
  role,
  permissions,
  onClose,
  onSaved,
}: {
  open: boolean;
  role: RoleTemplate | null;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setCode(role?.code ?? "");
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(role?.permissions.map(({ permission }) => permission.code) ?? []);
    setError("");
  }, [role, open]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (role) {
        await platformAdminApi.updateRole(role.id, { name, description });
        await platformAdminApi.replaceRolePermissions(role.id, selected);
      } else
        await platformAdminApi.createRole({ code, name, description, permissionCodes: selected });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Role could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  const grouped = groupPermissions(permissions);
  return (
    <Modal
      open={open}
      title={role ? `Edit ${role.name}` : "Create custom role"}
      description="Only permissions held by your current delegated session may be granted."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        {error ? <Alert>{error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">
            <input
              required
              disabled={Boolean(role)}
              pattern="[A-Z][A-Z0-9_]*"
              className={inputClass}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Name">
            <input
              required
              minLength={2}
              maxLength={160}
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            maxLength={400}
            rows={3}
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Permissions</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {grouped.map(([module, values]) => (
              <div key={module} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{module}</p>
                <div className="mt-2 space-y-2">
                  {values?.map((permission) => (
                    <label key={permission.code} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.includes(permission.code)}
                        onChange={(e) =>
                          setSelected((current) =>
                            e.target.checked
                              ? [...current, permission.code]
                              : current.filter((codeValue) => codeValue !== permission.code),
                          )
                        }
                      />
                      <span>
                        <strong className="block text-xs">{permission.code}</strong>
                        <span className="text-xs text-slate-500">{permission.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        {selected.length === 0 ? (
          <Alert tone="warning">Select at least one permission.</Alert>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || selected.length === 0}>
            {busy ? "Saving…" : "Save role"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
