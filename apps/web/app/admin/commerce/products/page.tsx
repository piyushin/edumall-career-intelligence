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
  inputClass,
} from "../../../../components/admin-ui";
import { hasPermission, isPlatformSession } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import {
  listAssessmentDefinitions,
  type AssessmentDefinitionSummary,
} from "../../../../lib/assessments";
import {
  commerceAdminApi,
  formatBps,
  formatMoney,
  fromMinor,
  toMinor,
  type CommerceProduct,
  type OrganizationPolicy,
  type OrganizationPrice,
  type PlatformPolicy,
  type ProductAudience,
  type ProductKind,
} from "../../../../lib/commerce-admin";
import { platformAdminApi, type OrganizationSummary } from "../../../../lib/platform-admin";

const KINDS: ProductKind[] = [
  "REPORT",
  "COUNSELLING",
  "REPORT_AND_COUNSELLING",
  "REPORT_CREDIT_PACK",
];
const AUDIENCES: ProductAudience[] = ["CANDIDATE", "ORGANIZATION", "COUNSELLOR"];

interface ProductForm {
  code: string;
  name: string;
  description: string;
  kind: ProductKind;
  audience: ProductAudience;
  unitQuantity: string;
  currency: string;
  price: string;
  minPrice: string;
  maxPrice: string;
  taxRateBps: string;
  organizationId: string;
  assessmentVersionId: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm: ProductForm = {
  code: "",
  name: "",
  description: "",
  kind: "REPORT",
  audience: "CANDIDATE",
  unitQuantity: "1",
  currency: "INR",
  price: "",
  minPrice: "",
  maxPrice: "",
  taxRateBps: "",
  organizationId: "",
  assessmentVersionId: "",
  status: "ACTIVE",
};

function formFrom(product: CommerceProduct): ProductForm {
  return {
    code: product.code,
    name: product.name,
    description: product.description ?? "",
    kind: product.kind,
    audience: product.audience,
    unitQuantity: String(product.unitQuantity),
    currency: product.currency,
    price: fromMinor(product.priceMinor),
    minPrice: fromMinor(product.minPriceMinor),
    maxPrice: fromMinor(product.maxPriceMinor),
    taxRateBps: product.taxRateBps === null ? "" : String(product.taxRateBps),
    organizationId: product.organizationId ?? "",
    assessmentVersionId: product.assessmentVersionId ?? "",
    status: product.status,
  };
}

function message(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

export default function CommerceProductsPage() {
  const session = useAdminSession();
  const platform = isPlatformSession(session);
  const canView = hasPermission(session, "commerce.view");
  const canManageCatalogue =
    platform &&
    hasPermission(session, "commerce.product.manage") &&
    hasPermission(session, "commerce.price.manage");
  const tenantOrganizationId = session?.session.organizationId ?? null;
  const canSetTenantPrice =
    !platform && tenantOrganizationId !== null && hasPermission(session, "commerce.price.manage");

  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [policy, setPolicy] = useState<PlatformPolicy | null>(null);
  const [organizationPolicy, setOrganizationPolicy] = useState<OrganizationPolicy | null>(null);
  const [organizationPrices, setOrganizationPrices] = useState<OrganizationPrice[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [definitions, setDefinitions] = useState<AssessmentDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CommerceProduct | "new" | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [pricing, setPricing] = useState<CommerceProduct | null>(null);
  const [sellingPrice, setSellingPrice] = useState("");
  const [policyEditing, setPolicyEditing] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    tenantCouponMaxDiscountBps: "",
    defaultTaxRateBps: "",
    taxInclusivePricing: true,
    counsellorFeePricingEnabled: false,
    counsellorFeeMin: "",
    counsellorFeeMax: "",
  });

  const load = useCallback(async () => {
    if (!canView) return setLoading(false);
    setLoading(true);
    setError("");
    try {
      const [productList, platformPolicy] = await Promise.all([
        commerceAdminApi.products(),
        commerceAdminApi.platformPolicy(),
      ]);
      setProducts(productList);
      setPolicy(platformPolicy);
      if (tenantOrganizationId) {
        const [orgPolicy, prices] = await Promise.all([
          commerceAdminApi.organizationPolicy(tenantOrganizationId),
          commerceAdminApi.organizationPrices(),
        ]);
        setOrganizationPolicy(orgPolicy);
        setOrganizationPrices(prices);
      }
      if (canManageCatalogue) {
        const [orgs, defs] = await Promise.all([
          hasPermission(session, "organization.view")
            ? platformAdminApi.organizations({ limit: "100" })
            : Promise.resolve(null),
          hasPermission(session, "assessment.view")
            ? listAssessmentDefinitions()
            : Promise.resolve([]),
        ]);
        setOrganizations(orgs?.items ?? []);
        setDefinitions(defs);
      }
    } catch (caught) {
      setError(message(caught, "Products could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [canManageCatalogue, canView, session, tenantOrganizationId]);
  useEffect(() => void load(), [load]);

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setEditing("new");
  }
  function openEdit(product: CommerceProduct) {
    setForm(formFrom(product));
    setFormError("");
    setEditing(product);
  }
  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const priceMinor = toMinor(form.price);
    const minPriceMinor = toMinor(form.minPrice);
    const maxPriceMinor = form.maxPrice.trim() ? toMinor(form.maxPrice) : null;
    if (priceMinor === undefined) {
      setFormError("Enter a valid base price.");
      setBusy(false);
      return;
    }
    const shared = {
      name: form.name,
      description: form.description || undefined,
      priceMinor,
      minPriceMinor: minPriceMinor ?? 0,
      maxPriceMinor,
      taxRateBps: form.taxRateBps.trim() ? Number(form.taxRateBps) : null,
      audience: form.audience,
      unitQuantity: Number(form.unitQuantity) || 1,
    };
    try {
      if (editing === "new") {
        await commerceAdminApi.createProduct({
          ...shared,
          code: form.code,
          kind: form.kind,
          currency: form.currency,
          organizationId: form.organizationId || undefined,
          assessmentVersionId: form.assessmentVersionId || undefined,
        });
        setNotice(`Product ${form.code.toUpperCase()} created.`);
      } else if (editing) {
        await commerceAdminApi.updateProduct(editing.id, { ...shared, status: form.status });
        setNotice(`Product ${editing.code} updated.`);
      }
      setEditing(null);
      await load();
    } catch (caught) {
      setFormError(message(caught, "The product could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function submitSellingPrice(event: FormEvent) {
    event.preventDefault();
    if (!pricing) return;
    setBusy(true);
    setFormError("");
    const sellingPriceMinor = toMinor(sellingPrice);
    if (sellingPriceMinor === undefined) {
      setFormError("Enter a valid selling price.");
      setBusy(false);
      return;
    }
    try {
      await commerceAdminApi.setOrganizationPrice({
        productCode: pricing.code,
        sellingPriceMinor,
      });
      setNotice(`Selling price for ${pricing.code} saved.`);
      setPricing(null);
      await load();
    } catch (caught) {
      setFormError(message(caught, "The selling price was not accepted."));
    } finally {
      setBusy(false);
    }
  }

  function openPolicy() {
    if (!policy) return;
    setPolicyForm({
      tenantCouponMaxDiscountBps: String(policy.tenantCouponMaxDiscountBps),
      defaultTaxRateBps: String(policy.defaultTaxRateBps),
      taxInclusivePricing: policy.taxInclusivePricing,
      counsellorFeePricingEnabled: policy.counsellorFeePricingEnabled,
      counsellorFeeMin: fromMinor(policy.counsellorFeeMinMinor),
      counsellorFeeMax: fromMinor(policy.counsellorFeeMaxMinor),
    });
    setFormError("");
    setPolicyEditing(true);
  }
  async function submitPolicy(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await commerceAdminApi.updatePlatformPolicy({
        tenantCouponMaxDiscountBps: Number(policyForm.tenantCouponMaxDiscountBps),
        defaultTaxRateBps: Number(policyForm.defaultTaxRateBps),
        taxInclusivePricing: policyForm.taxInclusivePricing,
        counsellorFeePricingEnabled: policyForm.counsellorFeePricingEnabled,
        counsellorFeeMinMinor: toMinor(policyForm.counsellorFeeMin) ?? 0,
        counsellorFeeMaxMinor: policyForm.counsellorFeeMax.trim()
          ? toMinor(policyForm.counsellorFeeMax)
          : null,
      });
      setNotice("Platform commercial policy updated.");
      setPolicyEditing(false);
      await load();
    } catch (caught) {
      setFormError(message(caught, "The platform policy could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  const tenantPriceFor = (productId: string) =>
    organizationPrices.find((price) => price.productId === productId && price.status === "ACTIVE");
  const versions = definitions.flatMap((definition) =>
    definition.versions.map((version) => ({
      id: version.id,
      label: `${definition.code} · v${version.versionNumber} · ${version.title}`,
    })),
  );

  return (
    <AdminRoute permission="commerce.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Commerce"
          title="Products & Pricing"
          description={
            platform
              ? "Backend-controlled catalogue. The platform owns the base price, floor, ceiling and tax policy; delegated tenant selling prices are shown separately on each organization."
              : "Platform products available to your organization. The base price is set by the platform; where delegated pricing is enabled you may set your own selling price inside the platform bounds."
          }
          actions={canManageCatalogue ? <Button onClick={openCreate}>New product</Button> : null}
        />
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : (
          <>
            {policy ? (
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Platform commercial policy
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Applies to every organization unless the platform narrows it per tenant.
                    </p>
                  </div>
                  {platform && hasPermission(session, "commerce.price.manage") ? (
                    <Button variant="secondary" onClick={openPolicy}>
                      Edit policy
                    </Button>
                  ) : null}
                </div>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Tenant coupon cap</dt>
                    <dd className="font-semibold">
                      {formatBps(policy.tenantCouponMaxDiscountBps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Default tax rate</dt>
                    <dd className="font-semibold">
                      {formatBps(policy.defaultTaxRateBps)} ·{" "}
                      {policy.taxInclusivePricing ? "inclusive" : "exclusive"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Counsellor fee pricing</dt>
                    <dd className="font-semibold">
                      {policy.counsellorFeePricingEnabled ? "Enabled" : "Disabled"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Counsellor fee bounds</dt>
                    <dd className="font-semibold">
                      {formatMoney(policy.counsellorFeeMinMinor)} –{" "}
                      {policy.counsellorFeeMaxMinor === null
                        ? "no ceiling"
                        : formatMoney(policy.counsellorFeeMaxMinor)}
                    </dd>
                  </div>
                </dl>
              </Panel>
            ) : null}

            {!platform && organizationPolicy ? (
              <Alert tone={organizationPolicy.delegatedPricingEnabled ? "info" : "warning"}>
                {organizationPolicy.delegatedPricingEnabled
                  ? "Delegated pricing is enabled for your organization. Selling prices you set apply only to your candidates and must stay inside the platform floor and ceiling."
                  : "Delegated pricing is not enabled for your organization. Candidates are charged the platform base price."}
              </Alert>
            ) : null}

            {products.length === 0 ? (
              <EmptyState
                title="No products"
                description="No commerce products are visible in your scope."
              />
            ) : (
              <Panel className="overflow-hidden p-0 sm:p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Kind · audience</th>
                        <th className="px-4 py-3">Scope</th>
                        <th className="px-4 py-3">Platform base price</th>
                        <th className="px-4 py-3">Floor / ceiling</th>
                        <th className="px-4 py-3">Tax</th>
                        {!platform ? <th className="px-4 py-3">Your selling price</th> : null}
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((product) => {
                        const tenantPrice = tenantPriceFor(product.id);
                        const delegable =
                          canSetTenantPrice &&
                          organizationPolicy?.delegatedPricingEnabled &&
                          product.kind !== "REPORT_CREDIT_PACK" &&
                          product.status === "ACTIVE";
                        return (
                          <tr key={product.id} className="align-top">
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-900">{product.name}</p>
                              <p className="text-xs text-slate-500">{product.code}</p>
                            </td>
                            <td className="px-4 py-4">
                              {product.kind.replaceAll("_", " ")}
                              <p className="text-xs text-slate-500">
                                {product.audience}
                                {product.kind === "REPORT_CREDIT_PACK"
                                  ? ` · ${product.unitQuantity} credits`
                                  : ""}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-xs">
                              {product.organizationId ? "Organization-specific" : "Platform-wide"}
                              {product.assessmentVersionId ? (
                                <p className="text-slate-500">Assessment-version bound</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {formatMoney(product.priceMinor, product.currency)}
                            </td>
                            <td className="px-4 py-4 text-xs">
                              {formatMoney(product.minPriceMinor, product.currency)} /{" "}
                              {product.maxPriceMinor === null
                                ? "—"
                                : formatMoney(product.maxPriceMinor, product.currency)}
                            </td>
                            <td className="px-4 py-4 text-xs">
                              {product.taxRateBps === null
                                ? `Platform default (${formatBps(policy?.defaultTaxRateBps)})`
                                : formatBps(product.taxRateBps)}
                            </td>
                            {!platform ? (
                              <td className="px-4 py-4">
                                {tenantPrice ? (
                                  <span className="font-semibold text-blue-800">
                                    {formatMoney(tenantPrice.sellingPriceMinor, product.currency)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    Platform base price applies
                                  </span>
                                )}
                              </td>
                            ) : null}
                            <td className="px-4 py-4">
                              <StatusBadge value={product.status} />
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {canManageCatalogue ? (
                                  <Button variant="secondary" onClick={() => openEdit(product)}>
                                    Edit
                                  </Button>
                                ) : null}
                                {delegable ? (
                                  <Button
                                    variant="secondary"
                                    onClick={() => {
                                      setSellingPrice(
                                        fromMinor(
                                          tenantPrice?.sellingPriceMinor ?? product.priceMinor,
                                        ),
                                      );
                                      setFormError("");
                                      setPricing(product);
                                    }}
                                  >
                                    Set selling price
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </>
        )}

        <Modal
          open={editing !== null}
          title={editing === "new" ? "New product" : `Edit ${editing?.code ?? ""}`}
          description="Prices are stored in minor units on the server and validated against the floor and ceiling there."
          onClose={() => setEditing(null)}
        >
          <form onSubmit={submitProduct} className="space-y-4">
            {formError ? <Alert>{formError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" hint="Immutable after creation.">
                <input
                  className={inputClass}
                  value={form.code}
                  disabled={editing !== "new"}
                  required
                  onChange={(e) => update("code", e.target.value)}
                />
              </Field>
              <Field label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  required
                  onChange={(e) => update("name", e.target.value)}
                />
              </Field>
              <Field label="Kind">
                <select
                  className={inputClass}
                  value={form.kind}
                  disabled={editing !== "new"}
                  onChange={(e) => {
                    const kind = e.target.value as ProductKind;
                    update("kind", kind);
                    update(
                      "audience",
                      kind === "REPORT_CREDIT_PACK" ? "ORGANIZATION" : "CANDIDATE",
                    );
                  }}
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Audience"
                hint="Credit packs are sold to organizations or counsellors; report and counselling packages to candidates."
              >
                <select
                  className={inputClass}
                  value={form.audience}
                  onChange={(e) => update("audience", e.target.value as ProductAudience)}
                >
                  {AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {audience}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unit quantity" hint="Credits per pack; 1 for other products.">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.unitQuantity}
                  onChange={(e) => update("unitQuantity", e.target.value)}
                />
              </Field>
              <Field label="Currency">
                <input
                  className={inputClass}
                  value={form.currency}
                  maxLength={3}
                  disabled={editing !== "new"}
                  onChange={(e) => update("currency", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Base price" hint="Charged unless a delegated tenant price applies.">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={form.price}
                  required
                  onChange={(e) => update("price", e.target.value)}
                />
              </Field>
              <Field label="Tax rate (bps)" hint="Blank uses the platform default.">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  className={inputClass}
                  value={form.taxRateBps}
                  onChange={(e) => update("taxRateBps", e.target.value)}
                />
              </Field>
              <Field label="Floor (minimum selling price)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={form.minPrice}
                  onChange={(e) => update("minPrice", e.target.value)}
                />
              </Field>
              <Field label="Ceiling (maximum selling price)" hint="Blank means no ceiling.">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={form.maxPrice}
                  onChange={(e) => update("maxPrice", e.target.value)}
                />
              </Field>
              {editing === "new" ? (
                <>
                  <Field label="Organization scope" hint="Blank makes the product platform-wide.">
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
                  <Field label="Assessment version scope" hint="Blank applies to every assessment.">
                    <select
                      className={inputClass}
                      value={form.assessmentVersionId}
                      onChange={(e) => update("assessmentVersionId", e.target.value)}
                    >
                      <option value="">All assessments</option>
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="Status">
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) => update("status", e.target.value as "ACTIVE" | "INACTIVE")}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </Field>
              )}
            </div>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={3}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save product"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={pricing !== null}
          title={`Selling price · ${pricing?.code ?? ""}`}
          description="Applies to your organization's candidates only. The platform validates the floor and ceiling; a selling price can never be zero."
          onClose={() => setPricing(null)}
        >
          <form onSubmit={submitSellingPrice} className="space-y-4">
            {formError ? <Alert>{formError}</Alert> : null}
            {pricing ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Platform base price</dt>
                  <dd className="font-semibold">
                    {formatMoney(pricing.priceMinor, pricing.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Floor</dt>
                  <dd className="font-semibold">
                    {formatMoney(pricing.minPriceMinor, pricing.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ceiling</dt>
                  <dd className="font-semibold">
                    {pricing.maxPriceMinor === null
                      ? "None"
                      : formatMoney(pricing.maxPriceMinor, pricing.currency)}
                  </dd>
                </div>
              </dl>
            ) : null}
            <Field label="Your selling price">
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

        <Modal
          open={policyEditing}
          title="Platform commercial policy"
          description="Central platform controls. Organization delegation is managed on each organization's detail page."
          onClose={() => setPolicyEditing(false)}
        >
          <form onSubmit={submitPolicy} className="space-y-4">
            {formError ? <Alert>{formError}</Alert> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tenant coupon cap (bps)" hint="10000 = 100%.">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  className={inputClass}
                  value={policyForm.tenantCouponMaxDiscountBps}
                  onChange={(e) =>
                    setPolicyForm((c) => ({ ...c, tenantCouponMaxDiscountBps: e.target.value }))
                  }
                />
              </Field>
              <Field label="Default tax rate (bps)">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  className={inputClass}
                  value={policyForm.defaultTaxRateBps}
                  onChange={(e) =>
                    setPolicyForm((c) => ({ ...c, defaultTaxRateBps: e.target.value }))
                  }
                />
              </Field>
              <Field label="Counsellor fee floor">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={policyForm.counsellorFeeMin}
                  onChange={(e) =>
                    setPolicyForm((c) => ({ ...c, counsellorFeeMin: e.target.value }))
                  }
                />
              </Field>
              <Field label="Counsellor fee ceiling" hint="Blank means no ceiling.">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={policyForm.counsellorFeeMax}
                  onChange={(e) =>
                    setPolicyForm((c) => ({ ...c, counsellorFeeMax: e.target.value }))
                  }
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={policyForm.taxInclusivePricing}
                onChange={(e) =>
                  setPolicyForm((c) => ({ ...c, taxInclusivePricing: e.target.checked }))
                }
              />
              Prices are tax-inclusive
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={policyForm.counsellorFeePricingEnabled}
                onChange={(e) =>
                  setPolicyForm((c) => ({ ...c, counsellorFeePricingEnabled: e.target.checked }))
                }
              />
              Allow counsellors to set their own counselling fee within bounds
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setPolicyEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save policy"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminRoute>
  );
}
