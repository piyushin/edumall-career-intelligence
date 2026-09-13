"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { AdminRoute } from "../../../components/admin-route";
import { useAdminSession } from "../../../components/admin-session";
import {
  Alert,
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
import { hasPermission } from "../../../lib/admin-authorization";
import { ApiError } from "../../../lib/api";
import {
  reportPlatformApi,
  type ReportSearchItem,
  type ReportSearchPage,
} from "../../../lib/report-platform";

const initial = {
  candidateName: "",
  mobile: "",
  email: "",
  submittedFrom: "",
  submittedTo: "",
  tenantName: "",
  assessmentId: "",
  generationStatus: "",
  entitlementStatus: "",
  counsellorUserId: "",
};

function generationLabel(item: ReportSearchItem): string {
  return item.generationStatus ?? "PENDING";
}

export default function AdminReportsPage() {
  const session = useAdminSession();
  const authorized = hasPermission(session, "report.search");
  const canViewCandidates = hasPermission(session, "candidate.view");
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [pageNumber, setPageNumber] = useState(1);
  const [data, setData] = useState<ReportSearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAttempt, setBusyAttempt] = useState("");

  const load = useCallback(async () => {
    if (!authorized) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      setData(
        await reportPlatformApi.adminList({
          ...Object.fromEntries(
            Object.entries(applied).map(([key, value]) => [key, value || undefined]),
          ),
          page: String(pageNumber),
          pageSize: "25",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applied, authorized, pageNumber]);

  useEffect(() => void load(), [load]);
  function update(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    setPageNumber(1);
    setApplied(filters);
  }
  async function retry(attemptId: string) {
    setBusyAttempt(attemptId);
    setActionError("");
    try {
      await reportPlatformApi.adminRetry(attemptId);
      await load();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Generation retry failed.");
    } finally {
      setBusyAttempt("");
    }
  }
  async function download(attemptId: string) {
    setBusyAttempt(attemptId);
    setActionError("");
    try {
      const file = await reportPlatformApi.adminPdf(attemptId);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "PDF download failed.");
    } finally {
      setBusyAttempt("");
    }
  }

  return (
    <AdminRoute permission="report.search">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Career Intelligence"
          title="Reports"
          description="Search generated-report records across your authorized scope. Record visibility and complete-report access are evaluated separately."
        />
        <Panel>
          <form onSubmit={apply} className="space-y-5">
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">Quick search</legend>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <Field label="Candidate name">
                  <input
                    className={inputClass}
                    value={filters.candidateName}
                    onChange={(e) => update("candidateName", e.target.value)}
                  />
                </Field>
                <Field label="Mobile">
                  <input
                    inputMode="tel"
                    className={inputClass}
                    value={filters.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    className={inputClass}
                    value={filters.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Field>
              </div>
            </fieldset>
            <details className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                Advanced filters
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Submitted from">
                  <input
                    type="date"
                    className={inputClass}
                    value={filters.submittedFrom}
                    onChange={(e) => update("submittedFrom", e.target.value)}
                  />
                </Field>
                <Field label="Submitted to">
                  <input
                    type="date"
                    className={inputClass}
                    value={filters.submittedTo}
                    onChange={(e) => update("submittedTo", e.target.value)}
                  />
                </Field>
                <Field label="Tenant / organization">
                  <input
                    className={inputClass}
                    value={filters.tenantName}
                    onChange={(e) => update("tenantName", e.target.value)}
                    placeholder="Organization name"
                  />
                </Field>
                <Field label="Assessment ID">
                  <input
                    className={inputClass}
                    value={filters.assessmentId}
                    onChange={(e) => update("assessmentId", e.target.value)}
                  />
                </Field>
                <Field label="Generation status">
                  <select
                    className={inputClass}
                    value={filters.generationStatus}
                    onChange={(e) => update("generationStatus", e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {["PENDING", "PROCESSING", "GENERATED", "BLOCKED_CONFIGURATION", "FAILED"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Candidate detailed access">
                  <select
                    className={inputClass}
                    value={filters.entitlementStatus}
                    onChange={(e) => update("entitlementStatus", e.target.value)}
                  >
                    <option value="">All access states</option>
                    {["ACTIVE", "CONSUMED", "REVOKED", "NONE"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Counsellor user ID">
                  <input
                    className={inputClass}
                    value={filters.counsellorUserId}
                    onChange={(e) => update("counsellorUserId", e.target.value)}
                  />
                </Field>
              </div>
            </details>
            <div className="flex gap-2">
              <Button type="submit">Search reports</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFilters(initial);
                  setApplied(initial);
                  setPageNumber(1);
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </Panel>
        {actionError ? <Alert>{actionError}</Alert> : null}
        {loading ? (
          <LoadingSkeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : !data?.items.length ? (
          <EmptyState
            title="No report records found"
            description="No submitted assessment in your authorized scope matched these filters."
          />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Mobile</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Assessment</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Generation</th>
                    <th className="px-4 py-3">Detailed access</th>
                    <th className="px-4 py-3">Counsellor</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item) => {
                    const generated = item.generationStatus === "GENERATED";
                    return (
                      <tr key={item.attemptId} className="align-top">
                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {item.candidate.firstName} {item.candidate.lastName}
                        </td>
                        <td className="px-4 py-4">{item.candidate.phoneE164 ?? "—"}</td>
                        <td className="px-4 py-4">{item.candidate.email}</td>
                        <td className="px-4 py-4">{item.organization.name}</td>
                        <td className="px-4 py-4">
                          {item.assessment.title}
                          <p className="text-xs text-slate-500">
                            {item.assessment.assessmentDefinition.code} · v
                            {item.assessment.versionNumber}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-xs">{formatDate(item.submittedAt)}</td>
                        <td className="px-4 py-4">
                          <StatusBadge value={generationLabel(item)} />
                          {item.generation?.lastErrorMessage ? (
                            <p className="mt-2 max-w-48 text-xs text-red-700">
                              {item.generation.lastErrorMessage}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge
                            value={
                              item.candidateEntitlementStatus === "ACTIVE" ? "UNLOCKED" : "LOCKED"
                            }
                          />
                          <p className="mt-2 text-xs text-slate-500">
                            {item.thirdPartyAccess.activeGrantCount} active third-party grant(s)
                          </p>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {item.counsellors.length
                            ? item.counsellors.map((c) => `${c.firstName} ${c.lastName}`).join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-44 flex-col items-start gap-2">
                            {canViewCandidates ? (
                              <Link
                                className="text-red-700 hover:underline"
                                href={`/admin/users/${item.candidate.id}`}
                              >
                                View candidate
                              </Link>
                            ) : null}
                            <Link
                              className="text-red-700 hover:underline"
                              href={`/admin/reports/${item.attemptId}`}
                            >
                              View report record
                            </Link>
                            {generated && item.canViewFullReport ? (
                              <Link
                                className="text-red-700 hover:underline"
                                href={`/admin/reports/${item.attemptId}`}
                              >
                                View full report
                              </Link>
                            ) : generated ? (
                              <span className="text-xs font-medium text-amber-700">
                                Report access required
                              </span>
                            ) : null}
                            {generated && item.canDownloadReport ? (
                              <button
                                className="text-red-700 hover:underline disabled:opacity-50"
                                disabled={busyAttempt === item.attemptId}
                                onClick={() => void download(item.attemptId)}
                              >
                                Download PDF
                              </button>
                            ) : null}
                            {item.canRetryGeneration ? (
                              <button
                                className="text-red-700 hover:underline disabled:opacity-50"
                                disabled={busyAttempt === item.attemptId}
                                onClick={() => void retry(item.attemptId)}
                              >
                                Retry generation
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-slate-100 p-4"
            >
              <p className="text-xs text-slate-500">
                Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} ·{" "}
                {data.pagination.total} records
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={pageNumber >= data.pagination.totalPages}
                  onClick={() => setPageNumber((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          </Panel>
        )}
      </div>
    </AdminRoute>
  );
}
