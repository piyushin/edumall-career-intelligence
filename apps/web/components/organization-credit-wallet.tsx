"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { hasPermission } from "../lib/admin-authorization";
import { ApiError } from "../lib/api";
import {
  reportCreditsApi,
  type LedgerEntry,
  type Wallet,
  type WalletStats,
} from "../lib/report-credits";
import { useAdminSession } from "./admin-session";
import { Alert, LoadingSkeleton, Panel, StatusBadge } from "./admin-ui";
import { LedgerTable } from "./credit-ledger-table";

// Central summary of one organization's report-credit wallet on its detail page.
export function OrganizationCreditWallet({ organizationId }: { organizationId: string }) {
  const session = useAdminSession();
  const canView = hasPermission(session, "report.credit.view");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [stats, setStats] = useState<WalletStats | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!canView) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      const result = await reportCreditsApi.organizationWallet(organizationId);
      setWallet(result.wallet);
      setStats(result.stats);
      setLedger(result.recentLedger);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Wallet could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [canView, organizationId]);
  useEffect(() => void load(), [load]);
  if (!canView) return null;
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Report-credit wallet</h2>
          <p className="mt-1 text-sm text-slate-600">
            One credit = one full-report grant for one attempt to one principal.
          </p>
        </div>
        {wallet ? (
          <Link
            href={`/admin/report-credits/${wallet.id}`}
            className="text-sm font-medium text-red-700 hover:underline"
          >
            Open credit workspace
          </Link>
        ) : null}
      </div>
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {loading ? (
        <div className="mt-4">
          <LoadingSkeleton rows={2} />
        </div>
      ) : !wallet || !stats ? (
        <p className="mt-4 text-sm text-slate-600">
          No wallet yet. It is created on the organization's first purchase, allotment or staff use.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-slate-500">Balance</dt>
              <dd className="text-2xl font-semibold">{wallet.currentBalance}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Purchased</dt>
              <dd className="font-semibold">{stats.purchased}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Allotted</dt>
              <dd className="font-semibold">{stats.allotted}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Transferred out</dt>
              <dd className="font-semibold">{stats.transferredOut}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Consumed</dt>
              <dd className="font-semibold">{stats.consumed}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge value={wallet.status} />
              </dd>
            </div>
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-slate-900">Recent ledger</h3>
          <div className="mt-2">
            <LedgerTable entries={ledger} />
          </div>
        </>
      )}
    </Panel>
  );
}
