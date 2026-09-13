"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { AdminRoute } from "../../../../../components/admin-route";
import { useAdminSession } from "../../../../../components/admin-session";
import {
  Alert,
  ConfirmDialog,
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
} from "../../../../../components/admin-ui";
import { hasPermission, isPlatformSession } from "../../../../../lib/admin-authorization";
import { ApiError } from "../../../../../lib/api";
import {
  commerceAdminApi,
  formatBps,
  formatMoney,
  type CommerceOrderDetail,
  type OrganizationPolicy,
} from "../../../../../lib/commerce-admin";

const MANUAL_METHODS = ["BANK_TRANSFER", "UPI", "CASH", "SPONSORED", "COMPLIMENTARY"];

function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export default function CommerceOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const session = useAdminSession();
  const platform = isPlatformSession(session);
  const central =
    session?.session.role === "SUPER_ADMIN" || session?.session.role === "PLATFORM_ADMIN";
  const canApprove = central && hasPermission(session, "commerce.payment.approve");
  const canRefund = central && hasPermission(session, "commerce.refund.manage");
  const tenantOrganizationId = session?.session.organizationId ?? null;

  const [order, setOrder] = useState<CommerceOrderDetail | null>(null);
  const [organizationPolicy, setOrganizationPolicy] = useState<OrganizationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"approve" | "cancel" | "refund" | "reference" | null>(null);
  const [approveForm, setApproveForm] = useState({ method: "BANK_TRANSFER", reference: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [refundForm, setRefundForm] = useState({ reference: "", reason: "", override: false });
  const [referenceForm, setReferenceForm] = useState({
    method: "BANK_TRANSFER",
    reference: "",
    note: "",
  });
  const [confirmRetry, setConfirmRetry] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await commerceAdminApi.order(orderId);
      setOrder(detail);
      if (!platform && tenantOrganizationId) {
        setOrganizationPolicy(await commerceAdminApi.organizationPolicy(tenantOrganizationId));
      }
    } catch (caught) {
      setError(message(caught, "This order could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [orderId, platform, tenantOrganizationId]);
  useEffect(() => void load(), [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setDialog(null);
      setConfirmRetry(false);
      await load();
    } catch (caught) {
      setActionError(message(caught, "The operation failed."));
    } finally {
      setBusy(false);
    }
  }

  const pendingManual = order?.payments.find(
    (payment) => payment.provider === "MANUAL" && payment.status === "PENDING",
  );
  const consumedEntitlement = order?.entitlements.some(
    (entitlement) => entitlement.status === "ACTIVE" && entitlement.type === "REPORT",
  );
  // Tenant admins may record a manual reference only for their own organization's
  // purchase and only when the platform enabled manual payment; the server enforces
  // the same rule.
  const canSubmitReference =
    order?.status === "PENDING" &&
    (central ||
      (order.purchaserType === "ORGANIZATION" &&
        order.organizationId === tenantOrganizationId &&
        Boolean(organizationPolicy?.manualPaymentEnabled)));

  return (
    <AdminRoute permission="commerce.view">
      {loading ? (
        <LoadingSkeleton rows={9} />
      ) : error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : !order ? (
        <EmptyState title="Order not found" description="No order is visible in your scope." />
      ) : (
        <div className="space-y-7">
          <Link
            href="/admin/commerce/orders"
            className="text-sm font-medium text-red-700 hover:underline"
          >
            ← Orders & Payments
          </Link>
          <PageHeader
            eyebrow="Order"
            title={`${order.product.name} · ${formatMoney(order.totalMinor, order.currency)}`}
            description={`Order ${order.id} · Created ${formatDate(order.createdAt)}`}
            actions={
              <>
                {canSubmitReference ? (
                  <Button variant="secondary" onClick={() => setDialog("reference")}>
                    {pendingManual ? "Update payment reference" : "Record payment reference"}
                  </Button>
                ) : null}
                {canApprove && order.status === "PENDING" ? (
                  <Button
                    onClick={() => {
                      setApproveForm({
                        method: pendingManual?.method ?? "BANK_TRANSFER",
                        reference: pendingManual?.reference ?? "",
                      });
                      setDialog("approve");
                    }}
                  >
                    Approve manual payment
                  </Button>
                ) : null}
                {canApprove && order.status === "PENDING" ? (
                  <Button variant="secondary" onClick={() => setDialog("cancel")}>
                    Cancel order
                  </Button>
                ) : null}
                {canRefund && order.status === "PAID" ? (
                  <Button variant="secondary" onClick={() => setDialog("refund")}>
                    Refund
                  </Button>
                ) : null}
                {canApprove && order.status === "PAID" && order.fulfilmentStatus !== "FULFILLED" ? (
                  <Button onClick={() => setConfirmRetry(true)}>Retry fulfilment</Button>
                ) : null}
              </>
            }
          />
          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {actionError ? <Alert>{actionError}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Panel>
              <p className="text-sm text-slate-500">Payment status</p>
              <div className="mt-3">
                <StatusBadge value={order.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {order.paidAt ? `Paid ${formatDate(order.paidAt)}` : "Not paid"}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Fulfilment</p>
              <div className="mt-3">
                <StatusBadge value={order.fulfilmentStatus} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {order.fulfilledAt ? `Fulfilled ${formatDate(order.fulfilledAt)}` : "Not fulfilled"}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Purchaser</p>
              <p className="mt-2 font-semibold">
                {order.user.firstName} {order.user.lastName}
              </p>
              <p className="text-xs text-slate-500">
                {order.purchaserType} · {order.user.email}
              </p>
              {order.purchaserType === "CANDIDATE" && order.attemptId ? (
                <Link
                  href={`/admin/reports/${order.attemptId}`}
                  className="mt-2 inline-block text-xs font-medium text-red-700 hover:underline"
                >
                  Open report record
                </Link>
              ) : null}
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Organization</p>
              <p className="mt-2 font-semibold">{order.organization.name}</p>
              {platform ? (
                <Link
                  href={`/admin/organizations/${order.organizationId}`}
                  className="mt-2 inline-block text-xs font-medium text-red-700 hover:underline"
                >
                  Organization detail
                </Link>
              ) : null}
            </Panel>
          </div>

          <Panel>
            <h2 className="text-lg font-semibold text-slate-950">Pricing snapshot</h2>
            <p className="mt-1 text-sm text-slate-600">
              The amounts actually charged at purchase time. They never change when catalogue prices
              change.
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-slate-500">Product</dt>
                <dd className="font-semibold">
                  {order.product.code}
                  {order.product.kind === "REPORT_CREDIT_PACK"
                    ? ` · ${order.product.unitQuantity * order.quantity} credits`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Pricing source</dt>
                <dd className="font-semibold">{order.pricingSource}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Platform base price</dt>
                <dd className="font-semibold">
                  {formatMoney(order.basePriceMinor, order.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Subtotal (charged unit price × qty)</dt>
                <dd className="font-semibold">
                  {formatMoney(order.subtotalMinor, order.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Discount</dt>
                <dd className="font-semibold">
                  {formatMoney(order.discountMinor, order.currency)}
                  {order.couponCodeSnapshot ? (
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      ({order.couponCodeSnapshot})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Tax</dt>
                <dd className="font-semibold">
                  {formatMoney(order.taxMinor, order.currency)}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    @ {formatBps(order.taxRateBps)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Total</dt>
                <dd className="text-lg font-semibold">
                  {formatMoney(order.totalMinor, order.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Quantity</dt>
                <dd className="font-semibold">{order.quantity}</dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold text-slate-950">Payment timeline</h2>
            {pendingManual ? (
              <Alert tone="warning">
                Manual payment reference <strong>{pendingManual.reference}</strong> (
                {pendingManual.method}) is awaiting central verification.
              </Alert>
            ) : null}
            {order.payments.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No payment attempts recorded.</p>
            ) : (
              <ol className="mt-4 divide-y divide-slate-100">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="grid gap-2 py-3 text-sm sm:grid-cols-5">
                    <span className="text-xs text-slate-500">{formatDate(payment.createdAt)}</span>
                    <span>
                      {payment.provider} · {payment.method}
                    </span>
                    <span>
                      <StatusBadge value={payment.status} />
                    </span>
                    <span className="font-medium">
                      {formatMoney(payment.amountMinor, payment.currency)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {payment.reference ? `Ref ${payment.reference}` : ""}
                      {payment.providerPaymentId ? ` ${payment.providerPaymentId}` : ""}
                      {payment.failureCode ? ` ${payment.failureCode}` : ""}
                      {payment.failureMessage ? ` – ${payment.failureMessage}` : ""}
                      {payment.completedAt ? ` · completed ${formatDate(payment.completedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <h2 className="text-lg font-semibold text-slate-950">Entitlements</h2>
              {order.entitlements.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No entitlements from this order.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {order.entitlements.map((entitlement) => (
                    <li key={entitlement.id} className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={entitlement.status} />
                      <span className="font-medium">{entitlement.type}</span>
                      <span className="text-xs text-slate-500">
                        {entitlement.source} · granted {formatDate(entitlement.grantedAt)}
                        {entitlement.revokedAt
                          ? ` · revoked ${formatDate(entitlement.revokedAt)}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <h2 className="text-lg font-semibold text-slate-950">Credit ledger</h2>
              {order.creditLedgerEntries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No credit movements from this order.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {order.creditLedgerEntries.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{entry.eventType}</span>
                      <span>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
                      <span className="text-xs text-slate-500">
                        balance {entry.balanceAfter} · {formatDate(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Modal
            open={dialog === "reference"}
            title="Record manual payment reference"
            description="Records the institution's bank transfer / UPI reference for central verification. Nothing is fulfilled until a central administrator approves it."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () => commerceAdminApi.submitManualPayment(order.id, referenceForm),
                  "Payment reference recorded and awaiting central approval.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Method">
                <select
                  className={inputClass}
                  value={referenceForm.method}
                  onChange={(e) => setReferenceForm((c) => ({ ...c, method: e.target.value }))}
                >
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="UPI">UPI</option>
                </select>
              </Field>
              <Field label="Transaction reference">
                <input
                  className={inputClass}
                  required
                  value={referenceForm.reference}
                  onChange={(e) => setReferenceForm((c) => ({ ...c, reference: e.target.value }))}
                />
              </Field>
              <Field label="Note (optional)">
                <input
                  className={inputClass}
                  value={referenceForm.note}
                  onChange={(e) => setReferenceForm((c) => ({ ...c, note: e.target.value }))}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Submit reference"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={dialog === "approve"}
            title="Approve manual payment"
            description="Central verification of payment evidence. Approval marks the order paid and fulfils it through the shared fulfilment service."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    commerceAdminApi.manualApprove(order.id, {
                      method: approveForm.method,
                      reference: approveForm.reference || undefined,
                    }),
                  "Payment approved and order fulfilled.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Method">
                <select
                  className={inputClass}
                  value={approveForm.method}
                  onChange={(e) => setApproveForm((c) => ({ ...c, method: e.target.value }))}
                >
                  {MANUAL_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reference / evidence">
                <input
                  className={inputClass}
                  value={approveForm.reference}
                  onChange={(e) => setApproveForm((c) => ({ ...c, reference: e.target.value }))}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Approving…" : "Approve & fulfil"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={dialog === "cancel"}
            title="Cancel order"
            description="Only pending orders can be cancelled. Pending gateway payments are marked failed."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    commerceAdminApi.cancelOrder(order.id, { reason: cancelReason || undefined }),
                  "Order cancelled.",
                );
              }}
              className="space-y-4"
            >
              <Field label="Reason">
                <input
                  className={inputClass}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Keep order
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Cancelling…" : "Cancel order"}
                </Button>
              </div>
            </form>
          </Modal>

          <Modal
            open={dialog === "refund"}
            title="Refund order"
            description="Records the refund, revokes entitlements from this order and reverses only unconsumed purchased credits. Returning funds through the gateway is done in the provider console."
            onClose={() => setDialog(null)}
          >
            <form
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                void run(
                  () =>
                    commerceAdminApi.refundOrder(order.id, {
                      reference: refundForm.reference || undefined,
                      reason: refundForm.reason || undefined,
                      override: refundForm.override || undefined,
                    }),
                  "Refund recorded.",
                );
              }}
              className="space-y-4"
            >
              {consumedEntitlement ? (
                <Alert tone="warning">
                  If the candidate has already opened the complete report, the server will require a
                  central override with a reason.
                </Alert>
              ) : null}
              <Field label="Refund reference">
                <input
                  className={inputClass}
                  value={refundForm.reference}
                  onChange={(e) => setRefundForm((c) => ({ ...c, reference: e.target.value }))}
                />
              </Field>
              <Field label="Reason" hint="Required when overriding a consumed entitlement.">
                <input
                  className={inputClass}
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm((c) => ({ ...c, reason: e.target.value }))}
                />
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={refundForm.override}
                  onChange={(e) => setRefundForm((c) => ({ ...c, override: e.target.checked }))}
                />
                Central exceptional override (entitlement already consumed)
              </label>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Refunding…" : "Record refund"}
                </Button>
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={confirmRetry}
            title="Retry fulfilment"
            impact="Runs the idempotent fulfilment service for this paid order. Already-granted entitlements or credits are not duplicated."
            confirmLabel="Retry fulfilment"
            busy={busy}
            onCancel={() => setConfirmRetry(false)}
            onConfirm={() =>
              void run(() => commerceAdminApi.retryFulfilment(order.id), "Fulfilment completed.")
            }
          />
        </div>
      )}
    </AdminRoute>
  );
}
