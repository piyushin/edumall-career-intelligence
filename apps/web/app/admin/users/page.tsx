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
import { canAccessGlobalRoute, hasPermission } from "../../../lib/admin-authorization";
import { ApiError } from "../../../lib/api";
import { platformAdminApi, type CursorPage, type UserSummary } from "../../../lib/platform-admin";

const initial = {
  search: "",
  organizationId: "",
  role: "",
  status: "",
  candidateSegment: "",
  assessmentState: "",
  reportState: "",
  paymentState: "",
  entitlementState: "",
};

export default function UsersPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "candidate.view");
  const commerce = hasPermission(session, "commerce.view");
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState<CursorPage<UserSummary> | null>(null);
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
        await platformAdminApi.users({
          ...Object.fromEntries(
            Object.entries(applied).map(([key, value]) => [key, value || undefined]),
          ),
          cursor,
          limit: "50",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Users could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applied, authorized, cursor]);
  useEffect(() => {
    void load();
  }, [load]);
  function update(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    setHistory([]);
    setCursor(undefined);
    setApplied(filters);
  }
  return (
    <PlatformRoute permission="candidate.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="People & access"
          title="Users & customers"
          description="Locate a user by identity, membership, assessment or authorized customer state. Credential and token material is never requested."
        />
        <Panel>
          <form onSubmit={apply} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Name, email or user ID">
              <input
                maxLength={200}
                className={inputClass}
                value={filters.search}
                onChange={(e) => update("search", e.target.value)}
              />
            </Field>
            <Field label="Organization ID">
              <input
                className={inputClass}
                value={filters.organizationId}
                onChange={(e) => update("organizationId", e.target.value)}
                placeholder="Organization UUID"
              />
            </Field>
            <Field label="Role">
              <select
                className={inputClass}
                value={filters.role}
                onChange={(e) => update("role", e.target.value)}
              >
                <option value="">All roles</option>
                {[
                  "SUPER_ADMIN",
                  "PLATFORM_ADMIN",
                  "ORGANIZATION_ADMIN",
                  "COUNSELLOR",
                  "ASSESSOR",
                  "STUDENT",
                  "EMPLOYEE",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Account status">
              <select
                className={inputClass}
                value={filters.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="">All statuses</option>
                {["INVITED", "ACTIVE", "SUSPENDED", "LOCKED", "ARCHIVED"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Candidate segment">
              <select
                className={inputClass}
                value={filters.candidateSegment}
                onChange={(e) => update("candidateSegment", e.target.value)}
              >
                <option value="">All segments</option>
                {[
                  "SCHOOL_6_8",
                  "SCHOOL_9_10",
                  "SCHOOL_11_12",
                  "COLLEGE",
                  "PROFESSIONAL",
                  "SKILLED_WORKFORCE",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Assessment state">
              <select
                className={inputClass}
                value={filters.assessmentState}
                onChange={(e) => update("assessmentState", e.target.value)}
              >
                <option value="">All states</option>
                <option>IN_PROGRESS</option>
                <option>SUBMITTED</option>
                <option>ABANDONED</option>
              </select>
            </Field>
            <Field label="Report state">
              <select
                className={inputClass}
                value={filters.reportState}
                onChange={(e) => update("reportState", e.target.value)}
              >
                <option value="">All states</option>
                <option>RELEASED</option>
                <option>NOT_RELEASED</option>
              </select>
            </Field>
            {commerce ? (
              <>
                <Field label="Order state">
                  <select
                    className={inputClass}
                    value={filters.paymentState}
                    onChange={(e) => update("paymentState", e.target.value)}
                  >
                    <option value="">All order states</option>
                    {["PENDING", "PAID", "CANCELLED", "REFUNDED"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Entitlement state">
                  <select
                    className={inputClass}
                    value={filters.entitlementState}
                    onChange={(e) => update("entitlementState", e.target.value)}
                  >
                    <option value="">All entitlement states</option>
                    <option>ACTIVE</option>
                    <option>CONSUMED</option>
                    <option>REVOKED</option>
                  </select>
                </Field>
              </>
            ) : null}
            <div className="flex items-end gap-2">
              <Button type="submit">Search users</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(initial);
                  setApplied(initial);
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
            title="No users found"
            description="No authorized user record matched these filters."
          />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Identity</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Memberships</th>
                    <th className="px-5 py-3">Assessments</th>
                    {commerce ? <th className="px-5 py-3">Customer state</th> : null}
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {page.items.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold text-red-700 hover:underline"
                          href={`/admin/users/${user.id}`}
                        >
                          {user.firstName} {user.lastName}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-400">{user.id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={user.status} />
                      </td>
                      <td className="px-5 py-4">
                        <p>{user.memberships.length} shown</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.memberships
                            .slice(0, 2)
                            .map(
                              (membership) =>
                                `${membership.organization.name} · ${membership.role}`,
                            )
                            .join("; ")}
                        </p>
                      </td>
                      <td className="px-5 py-4">{user._count?.assignedAssessments ?? 0}</td>
                      {commerce ? (
                        <td className="px-5 py-4">
                          <p>{user._count?.commerceOrders ?? 0} orders</p>
                          <p className="text-xs text-slate-500">
                            {user._count?.commerceEntitlements ?? 0} entitlements
                          </p>
                        </td>
                      ) : null}
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(user.createdAt)}
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
