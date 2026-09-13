import { apiRequest } from "./api";
import { queryString, type CommerceOrder, type PricingSource } from "./commerce-admin";
import type { PaymentIntent } from "./candidate-commerce";

export type WalletOwnerType = "USER" | "ORGANIZATION";
export type WalletStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type UnlockMode = "ORGANIZATION" | "COUNSELLOR" | "CANDIDATE";
export type UnlockItemStatus = "charged" | "already_granted" | `skipped:${string}`;

export interface WalletStats {
  purchased: number;
  allotted: number;
  transferredIn: number;
  transferredOut: number;
  consumed: number;
  reversed: number;
  revoked: number;
  remaining: number;
}

export interface Wallet {
  id: string;
  ownerType: WalletOwnerType;
  ownerUserId: string | null;
  ownerOrganizationId: string | null;
  status: WalletStatus;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
  ownerUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneE164: string | null;
  } | null;
  ownerOrganization?: { id: string; name: string } | null;
}

export interface WalletWithStats extends Wallet {
  stats: WalletStats;
}

export interface LedgerEntry {
  id: string;
  eventType: string;
  quantity: number;
  delta: number;
  balanceAfter: number;
  attemptId: string | null;
  orderId: string | null;
  reference: string | null;
  principalKey: string | null;
  transferId: string | null;
  createdAt: string;
  actorUser: { id: string; firstName: string; lastName: string; email: string } | null;
  order: { id: string; status: string; product: { code: string; name: string } } | null;
  attempt: {
    id: string;
    assignment: { user: { id: string; firstName: string; lastName: string } };
  } | null;
  reportAccessGrant: { id: string; principalType: string; status: string } | null;
  entitlement: { id: string; type: string; status: string; userId: string } | null;
}

export interface MyWallet {
  wallet: Wallet;
  stats: WalletStats;
  recentLedger: LedgerEntry[];
}

export interface UnlockResult {
  attemptId: string;
  mode: UnlockMode;
  status: UnlockItemStatus;
  grant: { id: string } | null;
  entitlement: { id: string } | null;
  ledgerEntry: { id: string } | null;
  balance: number | null;
}

export interface BulkUnlockResult {
  mode: UnlockMode;
  items: UnlockResult[];
  summary: { charged: number; alreadyGranted: number; skipped: number };
  balance: number | null;
}

export interface CreditPack {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unitQuantity: number;
  currency: string;
  priceMinor: number;
  pricingSource: PricingSource;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
}

export interface StaffOrder extends Omit<
  CommerceOrder,
  "user" | "organization" | "coupon" | "product"
> {
  product: { code: string; name: string; kind: string; unitQuantity: number };
  creditLedgerEntries: Array<{ id: string; eventType: string; quantity: number }>;
}

export interface StaffOrderResult {
  id: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  quantity: number;
  credits: number;
  paymentRequired: boolean;
}

export function unlockStatusLabel(status: UnlockItemStatus): string {
  if (status === "charged") return "Unlocked · 1 credit";
  if (status === "already_granted") return "Already granted · no charge";
  const reason = status.slice("skipped:".length).replaceAll("_", " ").toLowerCase();
  return `Skipped · ${reason}`;
}

// Whether the backend could possibly accept an unlock for a visible row; the
// server re-derives every condition, this only hides actions that cannot succeed.
export function canOfferUnlock(input: {
  generationStatus: string | null;
  canViewFullReport: boolean;
  walletStatus: WalletStatus | null | undefined;
  balance: number | null | undefined;
}): boolean {
  return (
    input.generationStatus === "GENERATED" &&
    !input.canViewFullReport &&
    input.walletStatus === "ACTIVE" &&
    (input.balance ?? 0) >= 1
  );
}

export const reportCreditsApi = {
  // central
  wallets: (query: Record<string, string | undefined>) =>
    apiRequest<{
      items: WalletWithStats[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>(`/admin/report-credits/wallets${queryString(query)}`),
  wallet: (id: string) =>
    apiRequest<WalletWithStats>(`/admin/report-credits/wallets/${encodeURIComponent(id)}`),
  ledger: (id: string, page: number) =>
    apiRequest<{
      items: LedgerEntry[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>(`/admin/report-credits/wallets/${encodeURIComponent(id)}/ledger?page=${page}&pageSize=50`),
  allot: (id: string, body: unknown) =>
    apiRequest(`/admin/report-credits/wallets/${encodeURIComponent(id)}/allot`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revoke: (id: string, body: unknown) =>
    apiRequest(`/admin/report-credits/wallets/${encodeURIComponent(id)}/revoke-unused`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setStatus: (id: string, body: unknown) =>
    apiRequest(`/admin/report-credits/wallets/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminTransfer: (body: unknown) =>
    apiRequest(`/admin/report-credits/transfers`, { method: "POST", body: JSON.stringify(body) }),
  adminCounsellors: (organizationId: string) =>
    apiRequest<Array<{ id: string; firstName: string; lastName: string; email: string }>>(
      `/admin/report-credits/counsellors${queryString({ organizationId })}`,
    ),
  organizationWallet: (organizationId: string) =>
    apiRequest<{ wallet: Wallet | null; stats: WalletStats | null; recentLedger: LedgerEntry[] }>(
      `/admin/report-credits/organizations/${encodeURIComponent(organizationId)}/wallet`,
    ),
  // staff
  myWallet: () => apiRequest<MyWallet>("/staff/report-credits/wallet"),
  counsellors: () =>
    apiRequest<Array<{ id: string; firstName: string; lastName: string; email: string }>>(
      "/staff/report-credits/counsellors",
    ),
  unlock: (body: { attemptId: string; mode: UnlockMode }) =>
    apiRequest<UnlockResult>("/staff/report-credits/unlock", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  bulkUnlock: (body: { attemptIds: string[]; mode: UnlockMode }) =>
    apiRequest<BulkUnlockResult>("/staff/report-credits/bulk-unlock", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  transfer: (body: unknown) =>
    apiRequest("/staff/report-credits/transfers", { method: "POST", body: JSON.stringify(body) }),
  creditPacks: () => apiRequest<CreditPack[]>("/staff/commerce/credit-packs"),
  orders: () => apiRequest<StaffOrder[]>("/staff/commerce/orders"),
  createOrder: (body: { productCode: string; quantity: number; couponCode?: string }) =>
    apiRequest<StaffOrderResult>("/staff/commerce/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  paymentIntent: (orderId: string) =>
    apiRequest<PaymentIntent>(
      `/staff/commerce/orders/${encodeURIComponent(orderId)}/payment-intent`,
      {
        method: "POST",
      },
    ),
  verifyPayment: (body: unknown) =>
    apiRequest("/staff/commerce/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  manualPayment: (orderId: string, body: unknown) =>
    apiRequest(`/staff/commerce/orders/${encodeURIComponent(orderId)}/manual-payment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
