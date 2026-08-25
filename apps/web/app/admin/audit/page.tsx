"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { PlatformRoute } from "../../../components/admin-route";
import { useAdminSession } from "../../../components/admin-session";
import {
  CursorPagination,
  EmptyState,
  ErrorState,
  Field,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
  inputClass,
} from "../../../components/admin-ui";
import { ApiError } from "../../../lib/api";
import { canAccessGlobalRoute } from "../../../lib/admin-authorization";
import { platformAdminApi, type AuditEntry, type CursorPage } from "../../../lib/platform-admin";

const emptyFilters = {
  actorUserId: "",
  subjectUserId: "",
  organizationId: "",
  action: "",
  entityType: "",
  entityId: "",
  outcome: "",
  purpose: "",
  from: "",
  to: "",
};

export default function AuditPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "audit.view");
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState<CursorPage<AuditEntry> | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!authorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setPage(
        await platformAdminApi.audit({
          ...Object.fromEntries(
            Object.entries(applied).map(([key, value]) => [key, value || undefined]),
          ),
          cursor,
          limit: "50",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Audit events could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applied, authorized, cursor]);
  useEffect(() => {
    void load();
  }, [load]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setHistory([]);
    setCursor(undefined);
    setApplied({
      ...filters,
      from: filters.from ? new Date(filters.from).toISOString() : "",
      to: filters.to ? new Date(filters.to).toISOString() : "",
    });
  }
  const field = (key: keyof typeof filters, label: string, placeholder = "UUID") => (
    <Field label={label}>
      <input
        maxLength={200}
        className={inputClass}
        value={filters[key]}
        onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))}
        placeholder={placeholder}
      />
    </Field>
  );
  return (
    <PlatformRoute permission="audit.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Governance"
          title="Audit trail"
          description="Search privileged activity using server-authorized filters and deterministic audit cursors. Raw metadata is never displayed."
        />
        <Panel>
          <form onSubmit={apply} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {field("actorUserId", "Actor user ID")}
            {field("subjectUserId", "Subject user ID")}
            {field("organizationId", "Organization ID")}
            {field("entityId", "Entity ID")}
            {field("action", "Action", "e.g. admin.suspended")}
            {field("entityType", "Entity type", "e.g. AdminProfile")}
            {field("purpose", "Purpose", "Review purpose")}
            <Field label="Outcome">
              <select
                className={inputClass}
                value={filters.outcome}
                onChange={(e) => setFilters((current) => ({ ...current, outcome: e.target.value }))}
              >
                <option value="">All outcomes</option>
                <option>ATTEMPTED</option>
                <option>SUCCEEDED</option>
                <option>FAILED</option>
              </select>
            </Field>
            <Field label="From">
              <input
                type="datetime-local"
                className={inputClass}
                value={filters.from}
                onChange={(e) => setFilters((current) => ({ ...current, from: e.target.value }))}
              />
            </Field>
            <Field label="To">
              <input
                type="datetime-local"
                className={inputClass}
                value={filters.to}
                onChange={(e) => setFilters((current) => ({ ...current, to: e.target.value }))}
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button type="submit">Search audit trail</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(emptyFilters);
                  setApplied(emptyFilters);
                  setCursor(undefined);
                  setHistory([]);
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </Panel>
        {loading ? (
          <LoadingSkeleton rows={7} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : !page?.items.length ? (
          <EmptyState
            title="No audit events"
            description="No events matched the authorized filters."
          />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Subject / entity</th>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Outcome</th>
                    <th className="px-5 py-3">Purpose / reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {page.items.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {entry.actorUser
                            ? `${entry.actorUser.firstName} ${entry.actorUser.lastName}`
                            : (entry.actorUserId ?? "System")}
                        </p>
                        {entry.actorUser?.email ? (
                          <p className="text-xs text-slate-500">{entry.actorUser.email}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">{entry.action}</td>
                      <td className="px-5 py-4">
                        <p>{entry.entityType}</p>
                        <p className="text-xs text-slate-500">
                          {entry.entityId ?? entry.subjectUserId ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {entry.organization?.name ?? entry.organizationId ?? "Platform"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={entry.outcome} />
                      </td>
                      <td className="px-5 py-4">
                        <p>{entry.purpose ?? "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.correlationId ?? entry.requestId ?? "No request reference"}
                        </p>
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
                  const values = [...history];
                  setCursor(values.pop());
                  setHistory(values);
                }}
                onNext={() => {
                  setHistory((values) => [...values, cursor]);
                  setCursor(page.pageInfo.nextCursor ?? undefined);
                }}
              />
            </div>
          </Panel>
        )}
      </div>
    </PlatformRoute>
  );
}
