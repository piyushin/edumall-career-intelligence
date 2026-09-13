"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LedgerTable } from "../../../components/credit-ledger-table";
import { useStaffSession } from "../../../components/staff-shell";
import { ApiError } from "../../../lib/api";
import { commerceAdminApi, formatBps, formatMoney } from "../../../lib/commerce-admin";
import { loadRazorpayScript, type RazorpayResult } from "../../../lib/razorpay-client";
import {
  reportCreditsApi,
  type CreditPack,
  type MyWallet,
  type StaffOrder,
} from "../../../lib/report-credits";

const input =
  "mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const primary =
  "rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const secondary =
  "rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-50";

function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError
    ? caught.message
    : caught instanceof Error
      ? caught.message
      : fallback;
}

export default function StaffCreditsPage() {
  const session = useStaffSession();
  const role = session?.session.role;
  const tenantAdmin = role === "ORGANIZATION_ADMIN";
  const counsellor = role === "COUNSELLOR";
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [counsellors, setCounsellors] = useState<
    Array<{ id: string; firstName: string; lastName: string; email: string }>
  >([]);
  const [manualPaymentEnabled, setManualPaymentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [selectedPack, setSelectedPack] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [couponCode, setCouponCode] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [manualFor, setManualFor] = useState<StaffOrder | null>(null);
  const [manualForm, setManualForm] = useState({ method: "BANK_TRANSFER", reference: "" });

  const load = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    setError("");
    try {
      const [myWallet, packList, orderList] = await Promise.all([
        reportCreditsApi.myWallet(),
        reportCreditsApi.creditPacks(),
        reportCreditsApi.orders(),
      ]);
      setWallet(myWallet);
      setPacks(packList);
      setOrders(orderList);
      if (tenantAdmin && session?.session.organizationId) {
        const [list, policy] = await Promise.all([
          reportCreditsApi.counsellors(),
          commerceAdminApi.organizationPolicy(session.session.organizationId),
        ]);
        setCounsellors(list);
        setManualPaymentEnabled(policy.manualPaymentEnabled);
      }
    } catch (caught) {
      setError(message(caught, "Credits could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [role, session?.session.organizationId, tenantAdmin]);
  useEffect(() => void load(), [load]);

  async function completePayment(orderId: string, response: RazorpayResult) {
    setWorking(true);
    try {
      await reportCreditsApi.verifyPayment({
        orderId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
      setNotice("Payment successful. Credits have been added to your wallet.");
      await load();
    } catch (caught) {
      setError(message(caught, "Payment verification failed."));
    } finally {
      setWorking(false);
    }
  }

  async function purchase(event: FormEvent) {
    event.preventDefault();
    if (!selectedPack) return setError("Select a credit pack.");
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const order = await reportCreditsApi.createOrder({
        productCode: selectedPack,
        quantity: Number(quantity) || 1,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      });
      if (!order.paymentRequired) {
        setNotice(`Order complete. ${order.credits} credits added to your wallet.`);
        await load();
        return;
      }
      const intent = await reportCreditsApi.paymentIntent(order.id);
      if (!intent.gatewayConfigured) {
        setNotice(
          manualPaymentEnabled
            ? "Order saved. Online payment is not configured; record your bank transfer / UPI reference below for central approval."
            : "Order saved. Online payment is not configured; contact the platform to complete payment.",
        );
        await load();
        return;
      }
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Payment gateway could not be loaded.");
      const razorpay = new window.Razorpay({
        key: intent.keyId,
        amount: intent.amountMinor,
        currency: intent.currency,
        name: "The EduMall",
        description: intent.description,
        order_id: intent.gatewayOrderId,
        ...(session?.user.email ? { prefill: { email: session.user.email } } : {}),
        theme: { color: "#1d4ed8" },
        handler: (response) => void completePayment(order.id, response),
      });
      razorpay.open();
      await load();
    } catch (caught) {
      setError(message(caught, "Unable to place the order."));
    } finally {
      setWorking(false);
    }
  }

  async function transfer(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await reportCreditsApi.transfer({
        counsellorUserId: transferTo,
        quantity: Number(transferQuantity) || 1,
        transferKey: crypto.randomUUID(),
      });
      setNotice("Credits transferred to the counsellor.");
      setTransferQuantity("1");
      await load();
    } catch (caught) {
      setError(message(caught, "Transfer failed."));
    } finally {
      setWorking(false);
    }
  }

  async function submitManual(event: FormEvent) {
    event.preventDefault();
    if (!manualFor) return;
    setWorking(true);
    setError("");
    try {
      await reportCreditsApi.manualPayment(manualFor.id, manualForm);
      setNotice("Payment reference recorded. Credits are added once the platform approves it.");
      setManualFor(null);
      await load();
    } catch (caught) {
      setError(message(caught, "The reference could not be recorded."));
    } finally {
      setWorking(false);
    }
  }

  const selected = packs.find((pack) => pack.code === selectedPack);
  const qty = Number(quantity) || 1;

  if (!session)
    return (
      <p className="text-sm text-slate-600" aria-busy="true">
        Loading…
      </p>
    );

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Report credits
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          {tenantAdmin ? "Organization credits" : "My credits"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          One credit unlocks the complete report of one assessment attempt for one principal.
          Prices, tax and totals are set by the platform.
        </p>
      </header>
      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {loading || !wallet ? (
        <p className="text-sm text-slate-600" aria-busy="true">
          Loading credits…
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Available balance</p>
              <p className="mt-2 text-3xl font-semibold">{wallet.wallet.currentBalance}</p>
              <p className="mt-1 text-xs text-slate-500">Wallet {wallet.wallet.status}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Purchased / allotted</p>
              <p className="mt-2 text-2xl font-semibold">
                {wallet.stats.purchased} / {wallet.stats.allotted}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                {tenantAdmin ? "Transferred to counsellors" : "Received from organization"}
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {tenantAdmin ? wallet.stats.transferredOut : wallet.stats.transferredIn}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Consumed</p>
              <p className="mt-2 text-2xl font-semibold">{wallet.stats.consumed}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Buy credits</h2>
            {wallet.wallet.status !== "ACTIVE" ? (
              <p className="mt-2 text-sm text-amber-800">
                Your wallet is {wallet.wallet.status.toLowerCase()}; purchases are not available.
              </p>
            ) : packs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No credit packs are available to you.</p>
            ) : (
              <form onSubmit={purchase} className="mt-4 grid gap-4 md:grid-cols-4">
                <label className="text-sm font-medium text-slate-800 md:col-span-2">
                  Credit pack
                  <select
                    className={input}
                    value={selectedPack}
                    onChange={(e) => setSelectedPack(e.target.value)}
                    required
                  >
                    <option value="">Select a pack</option>
                    {packs.map((pack) => (
                      <option key={pack.id} value={pack.code}>
                        {pack.name} · {pack.unitQuantity} credits ·{" "}
                        {formatMoney(pack.priceMinor, pack.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Quantity
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className={input}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-800">
                  Coupon (optional)
                  <input
                    className={input}
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  />
                </label>
                {selected ? (
                  <dl className="grid gap-3 text-sm md:col-span-4 md:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Credits</dt>
                      <dd className="font-semibold">{selected.unitQuantity * qty}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Price (platform)</dt>
                      <dd className="font-semibold">
                        {formatMoney(selected.priceMinor * qty, selected.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Tax @ {formatBps(selected.taxRateBps)}</dt>
                      <dd className="font-semibold">
                        {formatMoney(selected.taxMinor * qty, selected.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Indicative total</dt>
                      <dd className="font-semibold">
                        {formatMoney(selected.totalMinor * qty, selected.currency)}
                      </dd>
                      <p className="text-xs text-slate-500">
                        Final amount, coupon and tax are confirmed by the server on the order.
                      </p>
                    </div>
                  </dl>
                ) : null}
                <div className="md:col-span-4">
                  <button type="submit" className={primary} disabled={working}>
                    {working ? "Working…" : "Create order & pay"}
                  </button>
                </div>
              </form>
            )}
          </section>

          {tenantAdmin ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">
                Transfer credits to a counsellor
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Moves credits from the organization wallet to a counsellor of this organization. The
                counsellor then spends them on their own assigned candidates.
              </p>
              {counsellors.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  No active counsellors in your organization.
                </p>
              ) : (
                <form onSubmit={transfer} className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium text-slate-800 md:col-span-2">
                    Counsellor
                    <select
                      className={input}
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      required
                    >
                      <option value="">Select a counsellor</option>
                      {counsellors.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} · {user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-800">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={wallet.wallet.currentBalance}
                      className={input}
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(e.target.value)}
                    />
                  </label>
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      className={secondary}
                      disabled={
                        working ||
                        wallet.wallet.status !== "ACTIVE" ||
                        wallet.wallet.currentBalance < 1
                      }
                    >
                      Transfer
                    </button>
                  </div>
                </form>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Orders</h2>
            {orders.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No credit-pack orders yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Pack</th>
                      <th className="px-3 py-2">Credits</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2">Fulfilment</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => {
                      const pendingManual = order.payments.find(
                        (payment) => payment.provider === "MANUAL" && payment.status === "PENDING",
                      );
                      return (
                        <tr key={order.id}>
                          <td className="px-3 py-2 text-xs">
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">{order.product.name}</td>
                          <td className="px-3 py-2">
                            {order.product.unitQuantity * order.quantity}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            {formatMoney(order.totalMinor, order.currency)}
                            <p className="text-xs font-normal text-slate-500">
                              incl. tax {formatMoney(order.taxMinor, order.currency)}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {order.status}
                            {pendingManual ? (
                              <p className="text-amber-800">
                                Ref {pendingManual.reference} awaiting approval
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-xs">{order.fulfilmentStatus}</td>
                          <td className="px-3 py-2">
                            {order.status === "PENDING" && manualPaymentEnabled ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-blue-700 hover:underline"
                                onClick={() => {
                                  setManualForm({
                                    method: pendingManual?.method ?? "BANK_TRANSFER",
                                    reference: pendingManual?.reference ?? "",
                                  });
                                  setManualFor(order);
                                }}
                              >
                                {pendingManual
                                  ? "Update payment reference"
                                  : "Paid by bank transfer / UPI"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {manualFor ? (
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Record manual payment"
              className="rounded-2xl border border-blue-200 bg-blue-50 p-6"
            >
              <h2 className="text-lg font-semibold text-slate-950">
                Record payment reference · {formatMoney(manualFor.totalMinor, manualFor.currency)}
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Credits are added after the platform verifies the payment.
              </p>
              <form onSubmit={submitManual} className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-slate-800">
                  Method
                  <select
                    className={input}
                    value={manualForm.method}
                    onChange={(e) => setManualForm((c) => ({ ...c, method: e.target.value }))}
                  >
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="UPI">UPI</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-800 md:col-span-2">
                  Transaction reference
                  <input
                    className={input}
                    required
                    value={manualForm.reference}
                    onChange={(e) => setManualForm((c) => ({ ...c, reference: e.target.value }))}
                  />
                </label>
                <div className="flex gap-2 md:col-span-3">
                  <button type="submit" className={primary} disabled={working}>
                    Submit reference
                  </button>
                  <button type="button" className={secondary} onClick={() => setManualFor(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Recent ledger</h2>
            <div className="mt-4">
              <LedgerTable entries={wallet.recentLedger} admin={false} />
            </div>
          </section>
          {counsellor ? (
            <p className="text-xs text-slate-500">
              Credits you receive from your organization or purchase yourself can be spent on your
              assigned candidates from the Reports workspace.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
