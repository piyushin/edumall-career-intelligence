"use client";

import Link from "next/link";
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
import {
  platformAdminApi,
  type CursorPage,
  type OrganizationSummary,
} from "../../../lib/platform-admin";

export default function OrganizationsPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "organization.view");
  const [page, setPage] = useState<CursorPage<OrganizationSummary> | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ search: "", type: "", status: "" });
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
        await platformAdminApi.organizations({
          search: applied.search || undefined,
          type: applied.type || undefined,
          status: applied.status || undefined,
          cursor,
          limit: "50",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Organizations could not be loaded.");
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
    setApplied({ search: search.trim(), type, status });
  }
  return (
    <PlatformRoute permission="organization.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="People & access"
          title="Organizations"
          description="Read-only launch operations directory for platform and tenant organizations."
        />
        <Panel>
          <form onSubmit={apply} className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]">
            <Field label="Search">
              <input
                maxLength={200}
                className={inputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or slug"
              />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All types</option>
                {[
                  "PLATFORM",
                  "SCHOOL",
                  "COLLEGE",
                  "UNIVERSITY",
                  "CORPORATE",
                  "TRAINING_PARTNER",
                  "COUNSELLING_PARTNER",
                  "OTHER",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
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
                <option>ARCHIVED</option>
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
            title="No organizations"
            description="No organization matched the selected filters."
          />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Members</th>
                    <th className="px-5 py-3">Active</th>
                    <th className="px-5 py-3">Administrators</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {page.items.map((organization) => (
                    <tr key={organization.id}>
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold text-red-700 hover:underline"
                          href={`/admin/organizations/${organization.id}`}
                        >
                          {organization.name}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{organization.slug}</p>
                      </td>
                      <td className="px-5 py-4">{organization.type}</td>
                      <td className="px-5 py-4">
                        <StatusBadge value={organization.status} />
                      </td>
                      <td className="px-5 py-4">{organization.memberCount ?? 0}</td>
                      <td className="px-5 py-4">{organization.activeMemberCount}</td>
                      <td className="px-5 py-4">{organization.administratorCount}</td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(organization.createdAt)}
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
