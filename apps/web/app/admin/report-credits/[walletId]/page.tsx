"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { AdminRoute } from "../../../../components/admin-route";
import { useAdminSession } from "../../../../components/admin-session";
import {
  Alert,
  EmptyState,
  ErrorState,
  Field,
  LoadingSkeleton,
  Modal,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
  inputClass,
} from "../../../../components/admin-ui";
import { hasPermission } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import { LedgerTable } from "../../../../components/credit-ledger-table";
import {
  reportCreditsApi,
  type LedgerEntry,
  type WalletWithStats,
} from "../../../../lib/report-credits";

function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export default function WalletDetailPage() {
  const { walletId } = useParams<{ walletId: string }>();
  const session = useAdminSession();
  const central =
    session?.session.role === "SUPER_ADMIN" || session?.session.role === "PLATFORM_ADMIN";
  const canManage = central && hasPermission(session, "report.credit.manage");
  const [wallet, setWallet] = useState<WalletWithStats | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPages, setLedgerPages] = useState(1);
  const [counsellors, setCounsellors] = useState<
    Array<{ id: string; firstName: string; lastName: string; email: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"allot" | "revoke" | "status" | "transfer" | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "CLOSED">("SUSPENDED");
  const [counsellorUserId, setCounsellorUserId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, page] = await Promise.all([
        reportCreditsApi.wallet(walletId),
        reportCreditsApi.ledger(walletId, ledgerPage),
      ]);
      setWallet(detail);
      setLedger(page.items);
      setLedgerPages(page.pagination.totalPages);
      if (detail.ownerType === "ORGANIZATION" && detail.ownerOrganizationId && canManage) {
        setCounsellors(await reportCreditsApi.adminCounsellors(detail.ownerOrganizationId));
      }
    } catch (caught) {
      setError(message(caught, "The wallet could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [canManage, ledgerPage, walletId]);
  useEffect(() => void load(), [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setDialog(null);
      setQuantity("1");
      setReference("");
      await load();
    } catch (caught) {
      setActionError(message(caught, "The operation failed."));
    } finally {
      setBusy(false);
    }
  }

  const ownerLabel = wallet
    ? wallet.ownerType === "ORGANIZATION"
      ? (wallet.ownerOrganization?.name ?? "Organization")
      : `${wallet.ownerUser?.firstName ?? ""} ${wallet.ownerUser?.lastName ?? ""}`.trim()
    : "";

  return (
    <AdminRoute permission="report.credit.view">
      {loading ? (
        <LoadingSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : !wallet ? (
        <EmptyState title="Wallet not found" description="No wallet is visible in your scope." />
      ) : (
        <div className="space-y-7">
          <Link
            href="/admin/report-credits"
            className="text-sm font-medium text-red-700 hover:underline"
          >
            ← Report Credits
          </Link>
          <PageHeader
            eyebrow={`${wallet.ownerType} wallet`}
            title={ownerLabel}
            description={
              wallet.ownerUser
                ? `${wallet.ownerUser.email}${wallet.ownerUser.phoneE164 ? ` · ${wallet.ownerUser.phoneE164}` : ""}`
                : `Organization wallet · created ${formatDate(wallet.createdAt)}`
            }
            actions={
              canManage ? (
                <>
                  {wallet.status === "ACTIVE" ? (
                    <Button onClick={() => setDialog("allot")}>Complimentary allotment</Button>
                  ) : null}
                  {wallet.status === "ACTIVE" && wallet.stats.allotted > 0 ? (
                    <Button variant="secondary" onClick={() => setDialog("revoke")}>
                      Revoke unused allotment
                    </Button>
                  ) : null}
                  {wallet.ownerType === "ORGANIZATION" && wallet.status === "ACTIVE" ? (
                    <Button variant="secondary" onClick={() => setDialog("transfer")}>
                      Transfer to counsellor
                    </Button>
                  ) : null}
                  {wallet.status !== "CLOSED" ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setStatus(wallet.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
                        setDialog("status");
                      }}
                    >
                      {wallet.status === "ACTIVE" ? "Suspend / close" : "Reactivate / close"}
                    </Button>
                  ) : null}
                </>
              ) : null
            }
          />
          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {actionError ? <Alert>{actionError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Panel>
              <p className="text-sm text-slate-500">Remaining balance</p>
              <p className="mt-2 text-3xl font-semibold">{wallet.currentBalance}</p>
              <div className="mt-2">
                <StatusBadge value={wallet.status} />
              </div>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Purchased / allotted</p>
              <p className="mt-2 text-2xl font-semibold">
                {wallet.stats.purchased} / {wallet.stats.allotted}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Transferred in / out</p>
              <p className="mt-2 text-2xl font-semibold">
                {wallet.stats.transferredIn} / {wallet.stats.transferredOut}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Consumed / reversed / revoked</p>
              <p className="mt-2 text-2xl font-semibold">
                {wallet.stats.consumed} / {wallet.stats.reversed} / {wallet.stats.revoked}
              </p>
            </Panel>
          </div>
          <Panel>
            <h2 className="text-lg font-semibold text-slate-950">Ledger</h2>
            <p className="mt-1 text-sm text-slate-600">
              Append-only accounting evidence. Each consumption references the grant or entitlement
              it paid for.
            </p>
            <div className="mt-4">
              <LedgerTable entries={ledger} />
            </div>
            <nav aria-label="Ledger pagination" className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                disabled={ledgerPage <= 1}
                onClick={() => setLedgerPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={ledgerPage >= ledgerPages}
                onClick={() => setLedgerPage((p) => p + 1)}
              >
                Next
              </Button>
            </nav>
          </Panel>

          <Modal
            open={dialog === "allot"}
            title="Complimentary allotment"
            description="Central platform operation. Allotted credits are recorded as ADMIN_ALLOTMENT and can only be revoked while unused."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    reportCreditsApi.allot(wallet.id, {
                      quantity: Number(quantity),
                      reference: reference || undefined,
                    }),
                  "Credits allotted.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="Reference / reason">
                <input
                  className={inputClass}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Working…" : "Allot credits"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={dialog === "revoke"}
            title="Revoke unused complimentary credits"
            description="Only credits that were allotted and are still unused can be revoked; purchased and consumed credits are never touched."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    reportCreditsApi.revoke(wallet.id, {
                      quantity: Number(quantity),
                      reference: reference || undefined,
                    }),
                  "Unused complimentary credits revoked.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="Reason">
                <input
                  className={inputClass}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Working…" : "Revoke"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={dialog === "status"}
            title="Wallet status"
            description="Suspended wallets cannot spend, transfer or receive transfers. A wallet can be closed only with a zero balance, and never reopened."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    reportCreditsApi.setStatus(wallet.id, {
                      status,
                      reason: reference || undefined,
                    }),
                  `Wallet ${status.toLowerCase()}.`,
                );
              }}
              className="space-y-4"
            >
              <Field label="New status">
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  {wallet.status !== "ACTIVE" ? <option value="ACTIVE">ACTIVE</option> : null}
                  {wallet.status !== "SUSPENDED" ? (
                    <option value="SUSPENDED">SUSPENDED</option>
                  ) : null}
                  <option value="CLOSED">CLOSED</option>
                </select>
              </Field>
              <Field label="Reason">
                <input
                  className={inputClass}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Working…" : "Change status"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={dialog === "transfer"}
            title="Transfer to counsellor"
            description="Atomic organization → counsellor transfer inside the same organization. Both ledger legs share one transfer id."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    reportCreditsApi.adminTransfer({
                      sourceWalletId: wallet.id,
                      counsellorUserId,
                      quantity: Number(quantity),
                      reference: reference || undefined,
                      transferKey: crypto.randomUUID(),
                    }),
                  "Credits transferred.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Counsellor">
                <select
                  className={inputClass}
                  value={counsellorUserId}
                  required
                  onChange={(e) => setCounsellorUserId(e.target.value)}
                >
                  <option value="">Select an active counsellor</option>
                  {counsellors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} · {user.email}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  max={wallet.currentBalance}
                  className={inputClass}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="Reference">
                <input
                  className={inputClass}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Working…" : "Transfer"}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </AdminRoute>
  );
}
