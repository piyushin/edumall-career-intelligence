"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { AdminRoute } from "../../../components/admin-route";
import { useAdminSession } from "../../../components/admin-session";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  inputClass,
} from "../../../components/admin-ui";
import { hasPermission } from "../../../lib/admin-authorization";
import { ApiError } from "../../../lib/api";
import { reportCreditsApi, type WalletWithStats } from "../../../lib/report-credits";

const initial = { q: "", ownerType: "", status: "" };

function ownerLabel(wallet: WalletWithStats): string {
  if (wallet.ownerType === "ORGANIZATION") return wallet.ownerOrganization?.name ?? "Organization";
  const user = wallet.ownerUser;
  return user ? `${user.firstName} ${user.lastName}` : "User";
}

export default function ReportCreditsPage() {
  const session = useAdminSession();
  const central =
    session?.session.role === "SUPER_ADMIN" || session?.session.role === "PLATFORM_ADMIN";
  const authorized = central && hasPermission(session, "report.credit.view");
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [pageNumber, setPageNumber] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof reportCreditsApi.wallets>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!authorized) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      setData(
        await reportCreditsApi.wallets({
          q: applied.q || undefined,
          ownerType: applied.ownerType || undefined,
          status: applied.status || undefined,
          page: String(pageNumber),
          pageSize: "25",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Wallets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applied, authorized, pageNumber]);
  useEffect(() => void load(), [load]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setPageNumber(1);
    setApplied(filters);
  }

  return (
    <AdminRoute permission="report.credit.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Commerce"
          title="Report Credits"
          description="One report credit is one full-report access grant for one assessment attempt to one principal (candidate, organization or counsellor). Wallets hold credits; the immutable ledger is the accounting source of truth."
        />
        {!central ? (
          <EmptyState
            title="Central workspace"
            description="Wallet directory and complimentary allotment are central platform operations. Your organization's wallet is available in the staff workspace under Credits."
          />
        ) : (
          <>
            <Panel>
              <form onSubmit={apply} className="grid gap-4 md:grid-cols-4">
                <Field
                  label="Search"
                  hint="Organization name, or counsellor name / mobile / email."
                >
                  <input
                    className={inputClass}
                    value={filters.q}
                    onChange={(e) => setFilters((c) => ({ ...c, q: e.target.value }))}
                  />
                </Field>
                <Field label="Owner type">
                  <select
                    className={inputClass}
                    value={filters.ownerType}
                    onChange={(e) => setFilters((c) => ({ ...c, ownerType: e.target.value }))}
                  >
                    <option value="">All</option>
                    <option value="ORGANIZATION">Organization</option>
                    <option value="USER">Counsellor / user</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    className={inputClass}
                    value={filters.status}
                    onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}
                  >
                    <option value="">All</option>
                    {["ACTIVE", "SUSPENDED", "CLOSED"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end gap-2">
                  <Button type="submit">Search wallets</Button>
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
            {loading ? (
              <LoadingSkeleton rows={6} />
            ) : error ? (
              <ErrorState message={error} retry={() => void load()} />
            ) : !data?.items.length ? (
              <EmptyState
                title="No wallets found"
                description="Wallets are created on first purchase, allotment, transfer or staff use."
              />
            ) : (
              <Panel className="overflow-hidden p-0 sm:p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Owner</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Balance</th>
                        <th className="px-4 py-3">Purchased</th>
                        <th className="px-4 py-3">Allotted</th>
                        <th className="px-4 py-3">Transfers in / out</th>
                        <th className="px-4 py-3">Consumed</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.items.map((wallet) => (
                        <tr key={wallet.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">{ownerLabel(wallet)}</p>
                            {wallet.ownerUser ? (
                              <p className="text-xs text-slate-500">
                                {wallet.ownerUser.email}
                                {wallet.ownerUser.phoneE164
                                  ? ` · ${wallet.ownerUser.phoneE164}`
                                  : ""}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-xs">{wallet.ownerType}</td>
                          <td className="px-4 py-4 text-lg font-semibold">
                            {wallet.currentBalance}
                          </td>
                          <td className="px-4 py-4">{wallet.stats.purchased}</td>
                          <td className="px-4 py-4">{wallet.stats.allotted}</td>
                          <td className="px-4 py-4">
                            {wallet.stats.transferredIn} / {wallet.stats.transferredOut}
                          </td>
                          <td className="px-4 py-4">{wallet.stats.consumed}</td>
                          <td className="px-4 py-4">
                            <StatusBadge value={wallet.status} />
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              href={`/admin/report-credits/${wallet.id}`}
                              className="text-sm font-medium text-red-700 hover:underline"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <nav
                  aria-label="Pagination"
                  className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm"
                >
                  <span className="text-slate-600">
                    Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} ·{" "}
                    {data.pagination.total} wallets
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pageNumber >= data.pagination.totalPages}
                      onClick={() => setPageNumber((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </nav>
              </Panel>
            )}
          </>
        )}
      </div>
    </AdminRoute>
  );
}
