"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  UnlockActions,
  WalletBalanceBadge,
  staffRoleOf,
  unlockOffers,
  useStaffWallet,
} from "../../../components/report-unlock-actions";
import { useStaffSession } from "../../../components/staff-shell";
import { ApiError } from "../../../lib/api";
import {
  reportCreditsApi,
  unlockStatusLabel,
  type BulkUnlockResult,
  type UnlockMode,
} from "../../../lib/report-credits";
import { reportPlatformApi, type ReportSearchPage } from "../../../lib/report-platform";

// Server-side hard cap on one bulk request; mirrored so the UI never submits more.
const BULK_CAP = 200;

const initial = {
  candidateName: "",
  mobile: "",
  email: "",
  generationStatus: "",
  entitlementStatus: "",
};

export default function StaffReportsPage() {
  const session = useStaffSession();
  const role = staffRoleOf(session?.session.role);
  const tenantAdmin = role === "ORGANIZATION_ADMIN";
  const staffWallet = useStaffWallet(role);
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [pageNumber, setPageNumber] = useState(1);
  const [data, setData] = useState<ReportSearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<UnlockMode>("ORGANIZATION");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkUnlockResult | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await reportPlatformApi.staffList({
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
  }, [applied, pageNumber]);
  useEffect(() => void load(), [load]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setPageNumber(1);
    setApplied(filters);
  }

  // Rows the chosen bulk mode could apply to: generated, in scope, and not yet
  // granted to that principal. The server re-checks each one and reports
  // charged / already_granted / skipped per attempt.
  const bulkEligible = useMemo(() => {
    if (!tenantAdmin || !data) return new Set<string>();
    return new Set(
      data.items
        .filter((item) =>
          unlockOffers(role, item, staffWallet.wallet).some((offer) => offer.mode === bulkMode),
        )
        .map((item) => item.attemptId),
    );
  }, [bulkMode, data, role, staffWallet.wallet, tenantAdmin]);
  const selectedEligible = [...selected].filter((id) => bulkEligible.has(id));
  const balance = staffWallet.wallet?.wallet.currentBalance ?? 0;

  function toggle(attemptId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });
  }
  function selectAllEligible() {
    setSelected(new Set([...bulkEligible].slice(0, BULK_CAP)));
  }

  async function runBulk() {
    const attemptIds = selectedEligible.slice(0, BULK_CAP);
    if (attemptIds.length === 0) return;
    const label =
      bulkMode === "ORGANIZATION" ? "Unlock for organization" : "Sponsor candidate access";
    if (
      !window.confirm(
        `${label} for ${attemptIds.length} report${attemptIds.length === 1 ? "" : "s"}.\n\nOne credit is consumed per attempt that is actually unlocked (up to ${attemptIds.length}). Attempts already granted or not eligible are not charged.`,
      )
    )
      return;
    setBulkBusy(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const result = await reportCreditsApi.bulkUnlock({ attemptIds, mode: bulkMode });
      setBulkResult(result);
      setSelected(new Set());
      await Promise.all([load(), staffWallet.reload()]);
    } catch (caught) {
      setBulkError(caught instanceof ApiError ? caught.message : "Bulk unlock failed.");
    } finally {
      setBulkBusy(false);
    }
  }
  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Career Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Reports</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Search report records in your server-authorized tenant or candidate assignment scope.
          Seeing a record does not unlock its complete report; one credit unlocks one attempt for
          one principal.
        </p>
        <div className="mt-3">
          <WalletBalanceBadge wallet={staffWallet.wallet} error={staffWallet.error} role={role} />
        </div>
      </header>
      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-800">
            Candidate name
            <input
              className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              value={filters.candidateName}
              onChange={(e) => setFilters((v) => ({ ...v, candidateName: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Mobile
            <input
              inputMode="tel"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              value={filters.mobile}
              onChange={(e) => setFilters((v) => ({ ...v, mobile: e.target.value }))}
            />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Email
            <input
              type="email"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              value={filters.email}
              onChange={(e) => setFilters((v) => ({ ...v, email: e.target.value }))}
            />
          </label>
        </div>
        <details className="mt-4 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Advanced filters</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Generation status
              <select
                className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3"
                value={filters.generationStatus}
                onChange={(e) => setFilters((v) => ({ ...v, generationStatus: e.target.value }))}
              >
                <option value="">All statuses</option>
                {["PENDING", "PROCESSING", "GENERATED", "BLOCKED_CONFIGURATION", "FAILED"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm font-medium">
              Candidate access
              <select
                className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3"
                value={filters.entitlementStatus}
                onChange={(e) => setFilters((v) => ({ ...v, entitlementStatus: e.target.value }))}
              >
                <option value="">All access states</option>
                {["ACTIVE", "CONSUMED", "REVOKED", "NONE"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <div className="mt-4 flex gap-2">
          <button className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white">
            Search reports
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(initial);
              setApplied(initial);
              setPageNumber(1);
            }}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold"
          >
            Clear
          </button>
        </div>
      </form>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-600" aria-busy="true">
          Loading report records…
        </p>
      ) : !data?.items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
          No report records matched your authorized scope and filters.
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {tenantAdmin ? (
            <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-slate-800">
                  Bulk unlock as
                  <select
                    aria-label="Bulk unlock principal"
                    className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    value={bulkMode}
                    onChange={(e) => {
                      setBulkMode(e.target.value as UnlockMode);
                      setBulkResult(null);
                    }}
                  >
                    <option value="ORGANIZATION">Organization access — 1 credit each</option>
                    <option value="CANDIDATE">Sponsored candidate access — 1 credit each</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={selectAllEligible}
                  disabled={bulkEligible.size === 0}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Select eligible on this page ({bulkEligible.size})
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  disabled={selected.size === 0}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={() => void runBulk()}
                  disabled={
                    bulkBusy ||
                    selectedEligible.length === 0 ||
                    balance < 1 ||
                    staffWallet.wallet?.wallet.status !== "ACTIVE"
                  }
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {bulkBusy
                    ? "Unlocking…"
                    : `Unlock ${selectedEligible.length} selected · up to ${selectedEligible.length} credit${selectedEligible.length === 1 ? "" : "s"}`}
                </button>
                <span className="text-xs text-slate-500">
                  Max {BULK_CAP} per request · balance {balance}
                </span>
              </div>
              {selectedEligible.length > balance ? (
                <p className="text-xs text-amber-800">
                  You selected more reports than your balance covers; the server unlocks in order
                  until credits run out and reports the rest as skipped.
                </p>
              ) : null}
              {bulkError ? (
                <p role="alert" className="text-sm text-red-700">
                  {bulkError}
                </p>
              ) : null}
              {bulkResult ? (
                <div
                  role="status"
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                >
                  <p className="font-semibold text-slate-900">
                    {bulkResult.summary.charged} charged · {bulkResult.summary.alreadyGranted}{" "}
                    already granted · {bulkResult.summary.skipped} skipped
                    {bulkResult.balance !== null ? ` · balance now ${bulkResult.balance}` : ""}
                  </p>
                  <ul className="mt-2 grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                    {bulkResult.items.map((item) => {
                      const row = data.items.find((r) => r.attemptId === item.attemptId);
                      return (
                        <li key={item.attemptId}>
                          {row
                            ? `${row.candidate.firstName} ${row.candidate.lastName}`
                            : item.attemptId}
                          : {unlockStatusLabel(item.status)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {tenantAdmin ? (
                    <th className="px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                  ) : null}
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Assessment</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Generation</th>
                  <th className="px-4 py-3">Full report</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => (
                  <tr key={item.attemptId}>
                    {tenantAdmin ? (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.candidate.firstName} ${item.candidate.lastName}`}
                          checked={selected.has(item.attemptId)}
                          disabled={!bulkEligible.has(item.attemptId)}
                          onChange={() => toggle(item.attemptId)}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-4 font-semibold">
                      {item.candidate.firstName} {item.candidate.lastName}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {item.candidate.phoneE164 ?? "—"}
                      <br />
                      {item.candidate.email}
                    </td>
                    <td className="px-4 py-4">{item.organization.name}</td>
                    <td className="px-4 py-4">{item.assessment.title}</td>
                    <td className="px-4 py-4 text-xs">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                        {(item.generationStatus ?? "PENDING").replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {item.canViewFullReport ? (
                        <span className="text-xs font-semibold text-emerald-700">
                          Access allowed
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700">
                          Report access required
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {item.canViewFullReport && item.generationStatus === "GENERATED" ? (
                          <Link
                            className="font-medium text-blue-700 hover:underline"
                            href={`/staff/reports/${item.attemptId}`}
                          >
                            Open full report
                          </Link>
                        ) : (
                          <Link
                            className="font-medium text-slate-700 hover:underline"
                            href={`/staff/reports/${item.attemptId}`}
                          >
                            View record
                          </Link>
                        )}
                        <UnlockActions
                          role={role}
                          item={item}
                          wallet={staffWallet.wallet}
                          compact
                          onUnlocked={async () => {
                            await Promise.all([load(), staffWallet.reload()]);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Pagination" className="flex items-center justify-between border-t p-4">
            <p className="text-xs text-slate-500">
              Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)}
            </p>
            <div className="flex gap-2">
              <button
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((v) => v - 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pageNumber >= data.pagination.totalPages}
                onClick={() => setPageNumber((v) => v + 1)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        </section>
      )}
    </div>
  );
}
