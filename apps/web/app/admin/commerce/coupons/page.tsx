"use client";

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
import { hasPermission, isPlatformSession } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import {
  commerceAdminApi,
  couponValueLabel,
  formatBps,
  formatMoney,
  toMinor,
  type CommerceCoupon,
  type CommerceProduct,
  type CouponDiscountType,
  type CouponRedemption,
  type OrganizationPolicy,
  type PlatformPolicy,
  type ProductKind,
} from "../../../../lib/commerce-admin";
import { platformAdminApi, type OrganizationSummary } from "../../../../lib/platform-admin";

const KINDS: ProductKind[] = [
  "REPORT",
  "COUNSELLING",
  "REPORT_AND_COUNSELLING",
  "REPORT_CREDIT_PACK",
];

interface CouponForm {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  percentageBps: string;
  fixedAmount: string;
  productCode: string;
  appliesToKind: string;
  organizationId: string;
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  perUserLimit: string;
}

const emptyForm: CouponForm = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  percentageBps: "",
  fixedAmount: "",
  productCode: "",
  appliesToKind: "",
  organizationId: "",
  validFrom: "",
  validUntil: "",
  maxRedemptions: "",
  perUserLimit: "1",
};

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export default function CommerceCouponsPage() {
  const session = useAdminSession();
  const platform = isPlatformSession(session);
  const canView = hasPermission(session, "commerce.view");
  const canManage = hasPermission(session, "commerce.coupon.manage");
  const tenantOrganizationId = session?.session.organizationId ?? null;

  const [coupons, setCoupons] = useState<CommerceCoupon[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [policy, setPolicy] = useState<PlatformPolicy | null>(null);
  const [organizationPolicy, setOrganizationPolicy] = useState<OrganizationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [editing, setEditing] = useState<CommerceCoupon | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    validFrom: "",
    validUntil: "",
    maxRedemptions: "",
    perUserLimit: "1",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });
  const [drill, setDrill] = useState<{
    coupon: CommerceCoupon;
    redemptions: CouponRedemption[];
  } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const load = useCallback(async () => {
    if (!canView) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      const [couponList, productList, platformPolicy, orgs, orgPolicy] = await Promise.all([
        commerceAdminApi.coupons(),
        commerceAdminApi.products(),
        commerceAdminApi.platformPolicy(),
        platform && hasPermission(session, "organization.view")
          ? platformAdminApi.organizations({ limit: "100" })
          : Promise.resolve(null),
        tenantOrganizationId
          ? commerceAdminApi.organizationPolicy(tenantOrganizationId)
          : Promise.resolve(null),
      ]);
      setCoupons(couponList);
      setProducts(productList);
      setPolicy(platformPolicy);
      setOrganizations(orgs?.items ?? []);
      setOrganizationPolicy(orgPolicy);
    } catch (caught) {
      setError(message(caught, "Coupons could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [canView, platform, session, tenantOrganizationId]);
  useEffect(() => void load(), [load]);

  // Tenant coupons are only creatable when the platform enabled them; the
  // backend re-checks this and the cap regardless of what the UI shows.
  const tenantCouponsEnabled = platform || Boolean(organizationPolicy?.couponsEnabled);
  const effectiveCapBps =
    platform || !policy
      ? null
      : Math.min(
          policy.tenantCouponMaxDiscountBps,
          organizationPolicy?.couponMaxDiscountBps ?? policy.tenantCouponMaxDiscountBps,
        );

  function update<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await commerceAdminApi.createCoupon({
        code: form.code,
        description: form.description || undefined,
        discountType: form.discountType,
        percentageBps:
          form.discountType === "PERCENTAGE" ? Number(form.percentageBps) || undefined : undefined,
        fixedAmountMinor: form.discountType === "FIXED" ? toMinor(form.fixedAmount) : undefined,
        productCode: form.productCode || undefined,
        appliesToKind: form.appliesToKind || undefined,
        organizationId: platform ? form.organizationId || undefined : undefined,
        validFrom: toIso(form.validFrom),
        validUntil: toIso(form.validUntil),
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
      });
      setNotice(`Coupon ${form.code.toUpperCase()} created.`);
      setCreating(false);
      setForm(emptyForm);
      await load();
    } catch (caught) {
      setFormError(message(caught, "The coupon could not be created."));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(coupon: CommerceCoupon) {
    setEditForm({
      description: coupon.description ?? "",
      validFrom: toLocalInput(coupon.validFrom),
      validUntil: toLocalInput(coupon.validUntil),
      maxRedemptions: coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions),
      perUserLimit: String(coupon.perUserLimit),
      status: coupon.status,
    });
    setFormError("");
    setEditing(coupon);
  }
  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError("");
    try {
      await commerceAdminApi.updateCoupon(editing.id, {
        description: editForm.description,
        validFrom: toIso(editForm.validFrom),
        validUntil: editForm.validUntil ? toIso(editForm.validUntil) : null,
        maxRedemptions: editForm.maxRedemptions ? Number(editForm.maxRedemptions) : null,
        perUserLimit: Number(editForm.perUserLimit) || 1,
        status: editForm.status,
      });
      setNotice(`Coupon ${editing.code} updated.`);
      setEditing(null);
      await load();
    } catch (caught) {
      setFormError(message(caught, "The coupon could not be updated."));
    } finally {
      setBusy(false);
    }
  }
  async function toggleStatus(coupon: CommerceCoupon) {
    setBusy(true);
    setNotice("");
    try {
      await commerceAdminApi.updateCoupon(coupon.id, {
        status: coupon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      setNotice(
        `Coupon ${coupon.code} ${coupon.status === "ACTIVE" ? "deactivated" : "reactivated"}.`,
      );
      await load();
    } catch (caught) {
      setError(message(caught, "The coupon status could not be changed."));
    } finally {
      setBusy(false);
    }
  }
  async function openDrill(coupon: CommerceCoupon) {
    setDrillLoading(true);
    setDrill({ coupon, redemptions: [] });
    try {
      const result = await commerceAdminApi.couponRedemptions(coupon.id);
      setDrill({ coupon, redemptions: result.redemptions });
    } catch (caught) {
      setError(message(caught, "Redemptions could not be loaded."));
      setDrill(null);
    } finally {
      setDrillLoading(false);
    }
  }

  const canEditCoupon = (coupon: CommerceCoupon) =>
    canManage && (platform || coupon.organizationId === tenantOrganizationId);

  return (
    <AdminRoute permission="commerce.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Commerce"
          title="Coupons"
          description={
            platform
              ? "Free and complimentary coupons are central-only. Organization coupons are limited by the platform cap and can never discount below a product's floor."
              : "Organization-scoped discounts for your candidates. The platform sets whether coupons are enabled for your organization and the maximum discount; a coupon never reduces the price below the platform floor."
          }
          actions={
            canManage && tenantCouponsEnabled ? (
              <Button
                onClick={() => {
                  setForm(emptyForm);
                  setFormError("");
                  setCreating(true);
                }}
              >
                New coupon
              </Button>
            ) : null
          }
        />
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {!platform && organizationPolicy && !organizationPolicy.couponsEnabled ? (
          <Alert tone="warning">
            Organization coupons are not enabled for your organization by the platform.
          </Alert>
        ) : null}
        {!platform && effectiveCapBps !== null && tenantCouponsEnabled ? (
          <Alert tone="info">
            Your organization may discount up to {formatBps(effectiveCapBps)} on a bound product.
            Coupons require an expiry and a maximum redemption count.
          </Alert>
        ) : null}
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : coupons.length === 0 ? (
          <EmptyState title="No coupons" description="No coupons exist in your scope yet." />
        ) : (
          <Panel className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Binding</th>
                    <th className="px-4 py-3">Validity</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{coupon.code}</p>
                        {coupon.description ? (
                          <p className="text-xs text-slate-500">{coupon.description}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {coupon.organization ? coupon.organization.name : "Platform (central)"}
                      </td>
                      <td className="px-4 py-4 font-semibold">
                        {couponValueLabel(coupon)}
                        {coupon.discountType === "FREE" ? (
                          <p className="text-xs font-normal text-red-700">Central complimentary</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {coupon.product
                          ? `${coupon.product.code} · ${coupon.product.name}`
                          : "Any product"}
                        {coupon.appliesToKind ? (
                          <p className="text-slate-500">
                            {coupon.appliesToKind.replaceAll("_", " ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {formatDate(coupon.validFrom)} →{" "}
                        {coupon.validUntil ? formatDate(coupon.validUntil) : "no expiry"}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {coupon._count.redemptions} redeemed
                        {coupon.maxRedemptions !== null
                          ? ` of ${coupon.maxRedemptions}`
                          : ""} · {coupon.perUserLimit}/user
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={coupon.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => void openDrill(coupon)}>
                            Redemptions
                          </Button>
                          {canEditCoupon(coupon) ? (
                            <>
                              <Button variant="secondary" onClick={() => openEdit(coupon)}>
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void toggleStatus(coupon)}
                              >
                                {coupon.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Modal
          open={creating}
          title="New coupon"
          description={
            platform
              ? "Central coupons may be free, platform-wide or organization-scoped. The server validates every rule."
              : "Organization coupon: product-bound, within the platform cap, with an expiry and redemption limit. The server validates every rule."
          }
          onClose={() => setCreating(false)}
        >
          <form onSubmit={submitCreate} className="space-y-4">
            {formError ? <Alert>{formError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code">
                <input
                  className={inputClass}
                  value={form.code}
                  required
                  onChange={(e) => update("code", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Discount type">
                <select
                  className={inputClass}
                  value={form.discountType}
                  onChange={(e) => update("discountType", e.target.value as CouponDiscountType)}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                  {platform ? <option value="FREE">Free / complimentary (central)</option> : null}
                </select>
              </Field>
              {form.discountType === "PERCENTAGE" ? (
                <Field label="Percentage (bps)" hint="1000 = 10%.">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    className={inputClass}
                    value={form.percentageBps}
                    required
                    onChange={(e) => update("percentageBps", e.target.value)}
                  />
                </Field>
              ) : form.discountType === "FIXED" ? (
                <Field label="Fixed amount">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={form.fixedAmount}
                    required
                    onChange={(e) => update("fixedAmount", e.target.value)}
                  />
                </Field>
              ) : (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800">
                  A free coupon makes the order total zero and fulfils immediately. Central use
                  only.
                </div>
              )}
              <Field
                label="Product binding"
                hint={platform ? "Optional for central coupons." : "Required."}
              >
                <select
                  className={inputClass}
                  value={form.productCode}
                  required={!platform}
                  onChange={(e) => update("productCode", e.target.value)}
                >
                  <option value="">Any product</option>
                  {products
                    .filter((product) => platform || product.kind !== "REPORT_CREDIT_PACK")
                    .map((product) => (
                      <option key={product.id} value={product.code}>
                        {product.code} · {product.name} (
                        {formatMoney(product.priceMinor, product.currency)})
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Restrict to kind" hint="Optional.">
                <select
                  className={inputClass}
                  value={form.appliesToKind}
                  onChange={(e) => update("appliesToKind", e.target.value)}
                >
                  <option value="">Any kind</option>
                  {KINDS.filter((kind) => platform || kind !== "REPORT_CREDIT_PACK").map((kind) => (
                    <option key={kind} value={kind}>
                      {kind.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              {platform ? (
                <Field label="Organization scope" hint="Blank makes the coupon platform-wide.">
                  <select
                    className={inputClass}
                    value={form.organizationId}
                    onChange={(e) => update("organizationId", e.target.value)}
                  >
                    <option value="">Platform-wide</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Valid from" hint="Blank starts now.">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.validFrom}
                  onChange={(e) => update("validFrom", e.target.value)}
                />
              </Field>
              <Field
                label="Valid until"
                hint={platform ? "Optional for central coupons." : "Required."}
              >
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.validUntil}
                  required={!platform}
                  onChange={(e) => update("validUntil", e.target.value)}
                />
              </Field>
              <Field label="Max redemptions" hint={platform ? "Blank = unlimited." : "Required."}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.maxRedemptions}
                  required={!platform}
                  onChange={(e) => update("maxRedemptions", e.target.value)}
                />
              </Field>
              <Field label="Per-user limit">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.perUserLimit}
                  onChange={(e) => update("perUserLimit", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                className={inputClass}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Create coupon"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={editing !== null}
          title={`Edit ${editing?.code ?? ""}`}
          description="Discount type and value are immutable after creation; adjust validity, usage limits and status."
          onClose={() => setEditing(null)}
        >
          <form onSubmit={submitEdit} className="space-y-4">
            {formError ? <Alert>{formError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valid from">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={editForm.validFrom}
                  onChange={(e) => setEditForm((c) => ({ ...c, validFrom: e.target.value }))}
                />
              </Field>
              <Field label="Valid until">
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={editForm.validUntil}
                  required={!platform}
                  onChange={(e) => setEditForm((c) => ({ ...c, validUntil: e.target.value }))}
                />
              </Field>
              <Field label="Max redemptions">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={editForm.maxRedemptions}
                  required={!platform}
                  onChange={(e) => setEditForm((c) => ({ ...c, maxRedemptions: e.target.value }))}
                />
              </Field>
              <Field label="Per-user limit">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={editForm.perUserLimit}
                  onChange={(e) => setEditForm((c) => ({ ...c, perUserLimit: e.target.value }))}
                />
              </Field>
              <Field label="Status">
                <select
                  className={inputClass}
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((c) => ({ ...c, status: e.target.value as "ACTIVE" | "INACTIVE" }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <input
                className={inputClass}
                value={editForm.description}
                onChange={(e) => setEditForm((c) => ({ ...c, description: e.target.value }))}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save coupon"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={drill !== null}
          title={`Redemptions · ${drill?.coupon.code ?? ""}`}
          description="Paid orders count toward usage limits; pending checkouts do not."
          onClose={() => setDrill(null)}
        >
          {drillLoading ? (
            <LoadingSkeleton rows={3} />
          ) : !drill?.redemptions.length ? (
            <EmptyState
              title="No redemptions"
              description="This coupon has not been applied yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Redeemed</th>
                    <th className="py-2 pr-3">Candidate</th>
                    <th className="py-2 pr-3">Organization</th>
                    <th className="py-2 pr-3">Discount</th>
                    <th className="py-2 pr-3">Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drill.redemptions.map((redemption) => (
                    <tr key={redemption.id}>
                      <td className="py-2 pr-3 text-xs">{formatDate(redemption.redeemedAt)}</td>
                      <td className="py-2 pr-3">
                        {redemption.user.firstName} {redemption.user.lastName}
                        <p className="text-xs text-slate-500">{redemption.user.email}</p>
                      </td>
                      <td className="py-2 pr-3 text-xs">{redemption.order.organization.name}</td>
                      <td className="py-2 pr-3">
                        {formatMoney(redemption.discountMinor, redemption.order.currency)}
                      </td>
                      <td className="py-2 pr-3">
                        <a
                          className="text-xs font-medium text-red-700 hover:underline"
                          href={`/admin/commerce/orders/${redemption.order.id}`}
                        >
                          <StatusBadge value={redemption.order.status} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      </div>
    </AdminRoute>
  );
}
