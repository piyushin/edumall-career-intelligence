"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { hasPermission } from "../lib/admin-authorization";
import { ApiError } from "../lib/api";
import {
  commerceAdminApi,
  formatBps,
  formatMoney,
  fromMinor,
  toMinor,
  type CommerceProduct,
  type OrganizationPolicy,
  type OrganizationPrice,
} from "../lib/commerce-admin";
import { useAdminSession } from "./admin-session";
import { Alert, Field, LoadingSkeleton, Modal, Panel, StatusBadge, inputClass } from "./admin-ui";

// Central-admin control of one organization's commercial delegation plus the
// selling prices currently set for it. Rendered only inside the platform-scoped
// organization detail route; every mutation is re-authorized by the server.
export function OrganizationCommercePolicy({ organizationId }: { organizationId: string }) {
  const session = useAdminSession();
  const canView = hasPermission(session, "commerce.view");
  const canManage = hasPermission(session, "commerce.price.manage");
  const [policy, setPolicy] = useState<OrganizationPolicy | null>(null);
  const [prices, setPrices] = useState<OrganizationPrice[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    delegatedPricingEnabled: false,
    couponsEnabled: false,
    couponMaxDiscountBps: "",
    manualPaymentEnabled: false,
  });
  const [pricing, setPricing] = useState<CommerceProduct | null>(null);
  const [sellingPrice, setSellingPrice] = useState("");

  const load = useCallback(async () => {
    if (!canView) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      const [orgPolicy, orgPrices, productList] = await Promise.all([
        commerceAdminApi.organizationPolicy(organizationId),
        commerceAdminApi.organizationPrices(organizationId),
        commerceAdminApi.products(),
      ]);
      setPolicy(orgPolicy);
      setPrices(orgPrices);
      setProducts(productList);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Commerce policy could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [canView, organizationId]);
  useEffect(() => void load(), [load]);

  if (!canView) return null;

  async function submitPolicy(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await commerceAdminApi.updateOrganizationPolicy(organizationId, {
        delegatedPricingEnabled: form.delegatedPricingEnabled,
        couponsEnabled: form.couponsEnabled,
        couponMaxDiscountBps: form.couponMaxDiscountBps.trim()
          ? Number(form.couponMaxDiscountBps)
          : null,
        manualPaymentEnabled: form.manualPaymentEnabled,
      });
      setNotice("Organization commercial policy updated.");
      setEditing(false);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The policy could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function submitPrice(event: FormEvent) {
    event.preventDefault();
    if (!pricing) return;
    setBusy(true);
    setError("");
    const sellingPriceMinor = toMinor(sellingPrice);
    if (sellingPriceMinor === undefined) {
      setError("Enter a valid selling price.");
      setBusy(false);
      return;
    }
    try {
      await commerceAdminApi.setOrganizationPrice({
        organizationId,
        productCode: pricing.code,
        sellingPriceMinor,
      });
      setNotice(`Selling price for ${pricing.code} saved on behalf of the organization.`);
      setPricing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The selling price was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Commercial policy</h2>
          <p className="mt-1 text-sm text-slate-600">
            Platform-granted delegation for this organization. Tenant selling prices apply only to
            this organization's candidates and stay inside each product's floor and ceiling.
          </p>
        </div>
        {canManage && policy ? (
          <Button
            variant="secondary"
            onClick={() => {
              setForm({
                delegatedPricingEnabled: policy.delegatedPricingEnabled,
                couponsEnabled: policy.couponsEnabled,
                couponMaxDiscountBps:
                  policy.couponMaxDiscountBps === null ? "" : String(policy.couponMaxDiscountBps),
                manualPaymentEnabled: policy.manualPaymentEnabled,
              });
              setEditing(true);
            }}
          >
            Edit policy
          </Button>
        ) : null}
      </div>
      {notice ? (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {loading ? (
        <div className="mt-4">
          <LoadingSkeleton rows={2} />
        </div>
      ) : policy ? (
        <>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-500">Delegated pricing</dt>
              <dd>
                <StatusBadge value={policy.delegatedPricingEnabled ? "ENABLED" : "DISABLED"} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Tenant coupons</dt>
              <dd>
                <StatusBadge value={policy.couponsEnabled ? "ENABLED" : "DISABLED"} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Tenant coupon cap</dt>
              <dd className="font-semibold">
                {policy.couponMaxDiscountBps === null
                  ? "Platform cap"
                  : formatBps(policy.couponMaxDiscountBps)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Manual payment</dt>
              <dd>
                <StatusBadge value={policy.manualPaymentEnabled ? "ENABLED" : "DISABLED"} />
              </dd>
            </div>
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-slate-900">Tenant selling prices</h3>
          {prices.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No selling prices set. Candidates are charged the platform base price.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {prices.map((price) => (
                <li key={price.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="font-medium">{price.product.code}</span>
                  <span className="text-slate-500">
                    base {formatMoney(price.product.priceMinor, price.product.currency)}
                  </span>
                  <span className="font-semibold text-blue-800">
                    selling {formatMoney(price.sellingPriceMinor, price.product.currency)}
                  </span>
                  <StatusBadge value={price.status} />
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {products
                .filter(
                  (product) =>
                    product.status === "ACTIVE" &&
                    product.kind !== "REPORT_CREDIT_PACK" &&
                    (product.organizationId === null || product.organizationId === organizationId),
                )
                .map((product) => (
                  <Button
                    key={product.id}
                    variant="secondary"
                    onClick={() => {
                      setSellingPrice(
                        fromMinor(
                          prices.find((price) => price.productId === product.id)
                            ?.sellingPriceMinor ?? product.priceMinor,
                        ),
                      );
                      setPricing(product);
                    }}
                  >
                    Set price · {product.code}
                  </Button>
                ))}
            </div>
          ) : null}
        </>
      ) : null}

      <Modal
        open={editing}
        title="Organization commercial policy"
        description="Central platform control. A tenant coupon cap can only tighten the platform cap."
        onClose={() => setEditing(false)}
      >
        <form onSubmit={submitPolicy} className="space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.delegatedPricingEnabled}
              onChange={(e) =>
                setForm((c) => ({ ...c, delegatedPricingEnabled: e.target.checked }))
              }
            />
            Allow this organization to set its own selling price inside platform bounds
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.couponsEnabled}
              onChange={(e) => setForm((c) => ({ ...c, couponsEnabled: e.target.checked }))}
            />
            Allow organization-scoped percentage / fixed coupons
          </label>
          <Field label="Coupon cap (bps)" hint="Blank uses the platform cap.">
            <input
              type="number"
              min={0}
              max={10000}
              className={inputClass}
              value={form.couponMaxDiscountBps}
              onChange={(e) => setForm((c) => ({ ...c, couponMaxDiscountBps: e.target.value }))}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.manualPaymentEnabled}
              onChange={(e) => setForm((c) => ({ ...c, manualPaymentEnabled: e.target.checked }))}
            />
            Allow bank transfer / UPI references for institutional orders (central approval)
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save policy"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pricing !== null}
        title={`Selling price · ${pricing?.code ?? ""}`}
        description="Set on behalf of this organization. The server validates the floor and ceiling; a selling price can never be zero."
        onClose={() => setPricing(null)}
      >
        <form onSubmit={submitPrice} className="space-y-4">
          {pricing ? (
            <p className="text-sm text-slate-600">
              Base {formatMoney(pricing.priceMinor, pricing.currency)} · floor{" "}
              {formatMoney(pricing.minPriceMinor, pricing.currency)} · ceiling{" "}
              {pricing.maxPriceMinor === null
                ? "none"
                : formatMoney(pricing.maxPriceMinor, pricing.currency)}
            </p>
          ) : null}
          <Field label="Selling price">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={sellingPrice}
              required
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => setPricing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save selling price"}
            </Button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
