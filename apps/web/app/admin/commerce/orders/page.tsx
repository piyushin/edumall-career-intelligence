"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { AdminRoute } from "../../../../components/admin-route";
import { useAdminSession } from "../../../../components/admin-session";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
  inputClass,
} from "../../../../components/admin-ui";
import { hasPermission, isPlatformSession } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import { commerceAdminApi, formatMoney, type OrderPage } from "../../../../lib/commerce-admin";

const initial = {
  q: "",
  status: "",
  fulfilmentStatus: "",
  purchaserType: "",
  productKind: "",
  from: "",
  to: "",
};

export default function CommerceOrdersPage() {
  const session = useAdminSession();
  const authorized = hasPermission(session, "commerce.view");
  const platform = isPlatformSession(session);
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [pageNumber, setPageNumber] = useState(1);
  const [data, setData] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!authorized) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      setData(
        await commerceAdminApi.orders({
          ...Object.fromEntries(
            Object.entries(applied).map(([key, value]) => [key, value || undefined]),
          ),
          from: applied.from ? new Date(applied.from).toISOString() : undefined,
          to: applied.to ? new Date(`${applied.to}T23:59:59.999`).toISOString() : undefined,
          page: String(pageNumber),
          pageSize: "25",
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Orders could not be loaded.");
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

  return (
    <AdminRoute permission="commerce.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Commerce"
          title="Orders & Payments"
          description={
            platform
              ? "Every order across the platform with its payment timeline and fulfilment state. Approval, cancellation and refund are central operations."
              : "Orders placed in your organization. Manual payment references can be recorded here; approval is performed centrally."
          }
        />
        <Panel>
          <form onSubmit={apply} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="Search"
                hint="Order ID, attempt ID, name, email, mobile, tenant, product code or coupon."
              >
                <input
                  className={inputClass}
                  value={filters.q}
                  onChange={(e) => update("q", e.target.value)}
                />
              </Field>
              <Field label="Order status">
                <select
                  className={inputClass}
                  value={filters.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="">All</option>
                  {["PENDING", "PAID", "CANCELLED", "REFUNDED"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fulfilment">
                <select
                  className={inputClass}
                  value={filters.fulfilmentStatus}
                  onChange={(e) => update("fulfilmentStatus", e.target.value)}
                >
                  <option value="">All</option>
                  {["PENDING", "FULFILLED", "FAILED"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Purchaser">
                <select
                  className={inputClass}
                  value={filters.purchaserType}
                  onChange={(e) => update("purchaserType", e.target.value)}
                >
                  <option value="">All</option>
                  {["CANDIDATE", "ORGANIZATION", "COUNSELLOR"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Product kind">
                <select
                  className={inputClass}
                  value={filters.productKind}
                  onChange={(e) => update("productKind", e.target.value)}
                >
                  <option value="">All</option>
                  {["REPORT", "COUNSELLING", "REPORT_AND_COUNSELLING", "REPORT_CREDIT_PACK"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value.replaceAll("_", " ")}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <input
                    type="date"
                    className={inputClass}
                    value={filters.from}
                    onChange={(e) => update("from", e.target.value)}
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    className={inputClass}
                    value={filters.to}
                    onChange={(e) => update("to", e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Search orders</Button>
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
          <LoadingSkeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : !data?.items.length ? (
          <EmptyState
            title="No orders found"
            description="No order in your authorized scope matched these filters."
          />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Purchaser</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Pricing</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Fulfilment</th>
                    <th className="px-4 py-3">Latest payment</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((order) => {
                    const latest = order.payments[0];
                    return (
                      <tr key={order.id} className="align-top">
                        <td className="px-4 py-4 text-xs">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">
                            {order.user.firstName} {order.user.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.purchaserType} · {order.user.email}
                          </p>
                        </td>
                        <td className="px-4 py-4">{order.organization.name}</td>
                        <td className="px-4 py-4">
                          {order.product.name}
                          <p className="text-xs text-slate-500">
                            {order.product.code}
                            {order.quantity > 1 ? ` × ${order.quantity}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-semibold">
                          {formatMoney(order.totalMinor, order.currency)}
                          {order.couponCodeSnapshot ? (
                            <p className="text-xs font-normal text-slate-500">
                              Coupon {order.couponCodeSnapshot}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs">{order.pricingSource}</td>
                        <td className="px-4 py-4">
                          <StatusBadge value={order.status} />
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge value={order.fulfilmentStatus} />
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {latest ? `${latest.method} · ${latest.status}` : "—"}
                          {latest?.reference ? (
                            <p className="text-slate-500">Ref {latest.reference}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/commerce/orders/${order.id}`}
                            className="text-sm font-medium text-red-700 hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm"
            >
              <span className="text-slate-600">
                Page {data.pagination.page} of {Math.max(1, data.pagination.totalPages)} ·{" "}
                {data.pagination.total} orders
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
      </div>
    </AdminRoute>
  );
}
