import { apiRequest } from "./api";

export type ProductKind =
  "REPORT" | "COUNSELLING" | "REPORT_AND_COUNSELLING" | "REPORT_CREDIT_PACK";
export type ProductAudience = "CANDIDATE" | "ORGANIZATION" | "COUNSELLOR";
export type PricingSource = "PLATFORM" | "ORGANIZATION" | "COUNSELLOR";
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
export type FulfilmentStatus = "PENDING" | "FULFILLED" | "FAILED";
export type PurchaserType = "CANDIDATE" | "ORGANIZATION" | "COUNSELLOR";
export type CouponDiscountType = "FREE" | "PERCENTAGE" | "FIXED";

export interface CommerceProduct {
  id: string;
  organizationId: string | null;
  assessmentVersionId: string | null;
  code: string;
  name: string;
  description: string | null;
  kind: ProductKind;
  audience: ProductAudience;
  unitQuantity: number;
  currency: string;
  priceMinor: number;
  minPriceMinor: number;
  maxPriceMinor: number | null;
  taxRateBps: number | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPolicy {
  tenantCouponMaxDiscountBps: number;
  defaultTaxRateBps: number;
  taxInclusivePricing: boolean;
  counsellorFeePricingEnabled: boolean;
  counsellorFeeMinMinor: number;
  counsellorFeeMaxMinor: number | null;
}

export interface OrganizationPolicy {
  organizationId: string;
  delegatedPricingEnabled: boolean;
  couponsEnabled: boolean;
  couponMaxDiscountBps: number | null;
  manualPaymentEnabled: boolean;
}

export interface OrganizationPrice {
  id: string;
  organizationId: string;
  productId: string;
  sellingPriceMinor: number;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
  product: {
    code: string;
    name: string;
    kind: ProductKind;
    priceMinor: number;
    minPriceMinor: number;
    maxPriceMinor: number | null;
    currency: string;
  };
}

export interface CommerceCoupon {
  id: string;
  organizationId: string | null;
  productId: string | null;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  appliesToKind: ProductKind | null;
  percentageBps: number | null;
  fixedAmountMinor: number | null;
  validFrom: string;
  validUntil: string | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  product: { code: string; name: string; kind: ProductKind } | null;
  organization: { id: string; name: string } | null;
  _count: { redemptions: number };
}

export interface CouponRedemption {
  id: string;
  discountMinor: number;
  redeemedAt: string;
  user: { id: string; email: string; firstName: string; lastName: string };
  order: {
    id: string;
    status: OrderStatus;
    totalMinor: number;
    currency: string;
    organization: { id: string; name: string };
  };
}

export interface CommercePayment {
  id: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  method: string;
  status: string;
  amountMinor: number;
  currency: string;
  reference: string | null;
  approvedByUserId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CommerceOrder {
  id: string;
  organizationId: string;
  userId: string;
  attemptId: string | null;
  purchaserType: PurchaserType;
  quantity: number;
  basePriceMinor: number | null;
  pricingSource: PricingSource;
  status: OrderStatus;
  fulfilmentStatus: FulfilmentStatus;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  couponCodeSnapshot: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
  organization: { id: string; name: string };
  product: {
    code: string;
    name: string;
    kind: ProductKind;
    audience: ProductAudience;
    unitQuantity: number;
  };
  coupon: { code: string } | null;
  payments: CommercePayment[];
}

export interface CommerceOrderDetail extends CommerceOrder {
  entitlements: Array<{
    id: string;
    type: string;
    status: string;
    source: string;
    grantedAt: string;
    revokedAt: string | null;
    expiresAt: string | null;
  }>;
  creditLedgerEntries: Array<{
    id: string;
    walletId: string;
    eventType: string;
    quantity: number;
    delta: number;
    balanceAfter: number;
    createdAt: string;
  }>;
  couponRedemptions: Array<{ id: string; discountMinor: number; redeemedAt: string }>;
}

export interface OrderPage {
  items: CommerceOrder[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function queryString(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export function formatMoney(minor: number | null | undefined, currency = "INR"): string {
  if (minor === null || minor === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

export function formatBps(bps: number | null | undefined): string {
  return bps === null || bps === undefined ? "—" : `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
}

// Whole-currency input → minor units; the backend re-validates every amount.
export function toMinor(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : undefined;
}

export function fromMinor(minor: number | null | undefined): string {
  return minor === null || minor === undefined ? "" : (minor / 100).toFixed(2);
}

export function couponValueLabel(coupon: CommerceCoupon, currency = "INR"): string {
  if (coupon.discountType === "FREE") return "Free (100%)";
  if (coupon.discountType === "PERCENTAGE") return formatBps(coupon.percentageBps);
  return formatMoney(coupon.fixedAmountMinor, currency);
}

const base = "/admin/commerce";

export const commerceAdminApi = {
  products: () => apiRequest<CommerceProduct[]>(`${base}/products`),
  createProduct: (body: unknown) =>
    apiRequest<CommerceProduct>(`${base}/products`, { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: unknown) =>
    apiRequest<CommerceProduct>(`${base}/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  platformPolicy: () => apiRequest<PlatformPolicy>(`${base}/policy`),
  updatePlatformPolicy: (body: unknown) =>
    apiRequest<PlatformPolicy>(`${base}/policy`, { method: "PUT", body: JSON.stringify(body) }),
  organizationPolicy: (organizationId: string) =>
    apiRequest<OrganizationPolicy>(
      `${base}/organizations/${encodeURIComponent(organizationId)}/policy`,
    ),
  updateOrganizationPolicy: (organizationId: string, body: unknown) =>
    apiRequest<OrganizationPolicy>(
      `${base}/organizations/${encodeURIComponent(organizationId)}/policy`,
      { method: "PUT", body: JSON.stringify(body) },
    ),
  organizationPrices: (organizationId?: string) =>
    apiRequest<OrganizationPrice[]>(
      `${base}/organization-prices${queryString({ organizationId })}`,
    ),
  setOrganizationPrice: (body: unknown) =>
    apiRequest<OrganizationPrice>(`${base}/organization-prices`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  coupons: () => apiRequest<CommerceCoupon[]>(`${base}/coupons`),
  createCoupon: (body: unknown) =>
    apiRequest<CommerceCoupon>(`${base}/coupons`, { method: "POST", body: JSON.stringify(body) }),
  updateCoupon: (id: string, body: unknown) =>
    apiRequest<CommerceCoupon>(`${base}/coupons/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  couponRedemptions: (id: string) =>
    apiRequest<{ coupon: { id: string; code: string }; redemptions: CouponRedemption[] }>(
      `${base}/coupons/${encodeURIComponent(id)}/redemptions`,
    ),
  orders: (query: Record<string, string | undefined>) =>
    apiRequest<OrderPage>(`${base}/orders${queryString(query)}`),
  order: (id: string) =>
    apiRequest<CommerceOrderDetail>(`${base}/orders/${encodeURIComponent(id)}`),
  manualApprove: (id: string, body: unknown) =>
    apiRequest(`${base}/orders/${encodeURIComponent(id)}/manual-approve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitManualPayment: (id: string, body: unknown) =>
    apiRequest(`${base}/orders/${encodeURIComponent(id)}/manual-payment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelOrder: (id: string, body: unknown) =>
    apiRequest(`${base}/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  refundOrder: (id: string, body: unknown) =>
    apiRequest(`${base}/orders/${encodeURIComponent(id)}/refund`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  retryFulfilment: (id: string) =>
    apiRequest(`${base}/orders/${encodeURIComponent(id)}/fulfil`, { method: "POST" }),
};
