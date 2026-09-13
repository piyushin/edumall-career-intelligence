import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPermission } from "./admin-authorization";
import { API_BASE_URL } from "./api";
import type { AuthSession, MembershipRole } from "./auth";
import {
  commerceAdminApi,
  couponValueLabel,
  formatBps,
  formatMoney,
  fromMinor,
  toMinor,
  type CommerceCoupon,
} from "./commerce-admin";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}
function session(role: MembershipRole, organizationId: string | null, permissions: string[] = []) {
  return {
    session: { membershipId: "m", organizationId, role, userId: "u", permissions },
    user: { email: "admin@example.com" },
  } as AuthSession;
}
const pages = {
  products: "../app/admin/commerce/products/page.tsx",
  coupons: "../app/admin/commerce/coupons/page.tsx",
  orders: "../app/admin/commerce/orders/page.tsx",
  order: "../app/admin/commerce/orders/[orderId]/page.tsx",
  credits: "../app/admin/report-credits/page.tsx",
  organizationPolicy: "../components/organization-commerce-policy.tsx",
  shell: "../components/admin-shell.tsx",
};

afterEach(() => vi.restoreAllMocks());

describe("R20-C2b commerce admin library", () => {
  it("formats money, basis points and coupon values from minor units", () => {
    expect(formatMoney(49900)).toBe("₹499.00");
    expect(formatMoney(null)).toBe("—");
    expect(formatBps(1800)).toBe("18%");
    expect(formatBps(1250)).toBe("12.50%");
    expect(toMinor("499.99")).toBe(49999);
    expect(toMinor("abc")).toBeUndefined();
    expect(toMinor("-1")).toBeUndefined();
    expect(fromMinor(49900)).toBe("499.00");
    const coupon = { discountType: "FREE" } as CommerceCoupon;
    expect(couponValueLabel(coupon)).toBe("Free (100%)");
    expect(couponValueLabel({ ...coupon, discountType: "PERCENTAGE", percentageBps: 2500 })).toBe(
      "25%",
    );
  });

  it("targets the C2a admin commerce endpoints with encoded identifiers and filters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/csrf")
          ? new Response(JSON.stringify({ csrfToken: "token" }), { status: 200 })
          : new Response(JSON.stringify({ items: [], pagination: {} }), { status: 200 }),
      );
    await commerceAdminApi.orders({ q: "asha patel", status: "PAID", page: "2" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_BASE_URL}/admin/commerce/orders?q=asha+patel&status=PAID&page=2`,
    );
    await commerceAdminApi.organizationPolicy("org/1");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${API_BASE_URL}/admin/commerce/organizations/org%2F1/policy`,
    );
    await commerceAdminApi.refundOrder("order-1", { override: true, reason: "dup" });
    const refundCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/admin/commerce/orders/order-1/refund"),
    );
    expect(refundCall?.[1]?.method).toBe("POST");
    expect(new Headers(refundCall?.[1]?.headers).get("x-csrf-token")).toBe("token");
  });
});

describe("R20-C2b commerce permissions projection", () => {
  it("gives tenant admins delegated pricing and coupon permissions but no central operations", () => {
    const tenant = session("ORGANIZATION_ADMIN", "tenant-id");
    expect(hasPermission(tenant, "commerce.view")).toBe(true);
    expect(hasPermission(tenant, "commerce.price.manage")).toBe(true);
    expect(hasPermission(tenant, "commerce.coupon.manage")).toBe(true);
    expect(hasPermission(tenant, "commerce.product.manage")).toBe(false);
    expect(hasPermission(tenant, "commerce.payment.approve")).toBe(false);
    expect(hasPermission(tenant, "commerce.refund.manage")).toBe(false);
  });

  it("drives central commerce actions from effective platform permissions", () => {
    const delegated = session("PLATFORM_ADMIN", null, [
      "commerce.view",
      "commerce.payment.approve",
    ]);
    expect(hasPermission(delegated, "commerce.payment.approve")).toBe(true);
    expect(hasPermission(delegated, "commerce.refund.manage")).toBe(false);
    expect(hasPermission(delegated, "commerce.product.manage")).toBe(false);
  });
});

describe("R20-C2b Control Centre commerce routes", () => {
  it("implements every commerce route and the Commerce navigation group", () => {
    for (const relative of Object.values(pages))
      expect(() => source(relative), relative).not.toThrow();
    const shell = source(pages.shell).replace(/\s+/g, " ");
    expect(shell).toContain('label: "Commerce"');
    expect(shell).toContain('label: "Products & Pricing", href: "/admin/commerce/products"');
    expect(shell).toContain('label: "Orders & Payments", href: "/admin/commerce/orders"');
    expect(shell).toContain('label: "Coupons", href: "/admin/commerce/coupons"');
    expect(shell).toContain('label: "Report Credits", href: "/admin/report-credits"');
    expect(shell).toContain('permission: "report.credit.view"');
  });

  it("guards every commerce page with a server-validated permission", () => {
    for (const key of ["products", "coupons", "orders", "order"] as const) {
      expect(source(pages[key]), key).toContain('<AdminRoute permission="commerce.view">');
    }
    expect(source(pages.credits)).toContain('<AdminRoute permission="report.credit.view">');
  });

  it("keeps catalogue and platform policy central and shows tenant selling price separately", () => {
    const products = source(pages.products);
    expect(products).toContain('hasPermission(session, "commerce.product.manage")');
    expect(products).toContain('hasPermission(session, "commerce.price.manage")');
    expect(products).toContain("organizationPolicy?.delegatedPricingEnabled");
    expect(products).toContain("Platform base price");
    expect(products).toContain("Your selling price");
    expect(products).toContain("Platform base price applies");
    expect(products).toContain('product.kind !== "REPORT_CREDIT_PACK"');
    // Bounds are displayed as server-provided facts, never re-validated client-side.
    expect(products).not.toMatch(
      /sellingPriceMinor\s*[<>]=?\s*(pricing|product)\.(min|max)PriceMinor/,
    );
  });

  it("controls organization commercial delegation centrally", () => {
    const policy = source(pages.organizationPolicy);
    expect(policy).toContain('hasPermission(session, "commerce.price.manage")');
    expect(policy).toContain("delegatedPricingEnabled");
    expect(policy).toContain("couponsEnabled");
    expect(policy).toContain("couponMaxDiscountBps");
    expect(policy).toContain("manualPaymentEnabled");
    expect(source("../app/admin/organizations/[organizationId]/page.tsx")).toContain(
      "<OrganizationCommercePolicy",
    );
  });

  it("reserves free coupons for central sessions and mirrors backend tenant limits", () => {
    const coupons = source(pages.coupons);
    expect(coupons).toContain('hasPermission(session, "commerce.coupon.manage")');
    expect(coupons).toContain("organizationPolicy?.couponsEnabled");
    expect(coupons).toContain('platform ? <option value="FREE">');
    expect(coupons).toContain("couponRedemptions");
    expect(coupons).toContain("Redemptions");
    expect(coupons).not.toMatch(/5000|50\s?%/);
  });

  it("gates order operations by central permission and exposes the manual-payment workflow", () => {
    const order = source(pages.order);
    expect(order).toContain('hasPermission(session, "commerce.payment.approve")');
    expect(order).toContain('hasPermission(session, "commerce.refund.manage")');
    expect(order).toContain("submitManualPayment");
    expect(order).toContain("manualApprove");
    expect(order).toContain("cancelOrder");
    expect(order).toContain("refundOrder");
    expect(order).toContain("retryFulfilment");
    expect(order).toContain("override");
    expect(order).toContain("Pricing snapshot");
    expect(order).toContain("Payment timeline");
    expect(order).toContain("organizationPolicy?.manualPaymentEnabled");
    const orders = source(pages.orders);
    expect(orders).toContain("fulfilmentStatus");
    expect(orders).toContain("purchaserType");
    expect(orders).toContain("Pagination");
  });

  it("never reintroduces report release approval or client-side prices", () => {
    const combined = Object.values(pages).map(source).join("\n");
    expect(combined).not.toMatch(/reportRelease|releaseReport|approveRelease/);
    expect(combined).not.toMatch(/localStorage|sessionStorage/);
    expect(combined).not.toMatch(/totalMinor\s*[:=]\s*[a-zA-Z]+\s*[-+*]/);
  });
});
