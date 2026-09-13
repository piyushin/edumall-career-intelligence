import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UnlockActions,
  WalletBalanceBadge,
  staffRoleOf,
  unlockOffers,
} from "../components/report-unlock-actions";
import { API_BASE_URL } from "./api";
import {
  canOfferUnlock,
  reportCreditsApi,
  unlockStatusLabel,
  type MyWallet,
} from "./report-credits";
import type { ReportSearchItem } from "./report-platform";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const pages = {
  staffReports: "../app/staff/reports/page.tsx",
  staffReport: "../app/staff/reports/[attemptId]/page.tsx",
  staffCredits: "../app/staff/credits/page.tsx",
  adminCredits: "../app/admin/report-credits/page.tsx",
  adminWallet: "../app/admin/report-credits/[walletId]/page.tsx",
  staffShell: "../components/staff-shell.tsx",
  organizationDetail: "../app/admin/organizations/[organizationId]/page.tsx",
  candidate360: "../app/admin/users/[userId]/page.tsx",
};

function wallet(overrides: Partial<MyWallet["wallet"]> = {}): MyWallet {
  return {
    wallet: {
      id: "w",
      ownerType: "ORGANIZATION",
      ownerUserId: null,
      ownerOrganizationId: "org",
      status: "ACTIVE",
      currentBalance: 3,
      createdAt: "",
      updatedAt: "",
      ...overrides,
    },
    stats: {
      purchased: 3,
      allotted: 0,
      transferredIn: 0,
      transferredOut: 0,
      consumed: 0,
      reversed: 0,
      revoked: 0,
      remaining: 3,
    },
    recentLedger: [],
  };
}

function item(overrides: Partial<ReportSearchItem> = {}): ReportSearchItem {
  return {
    attemptId: "a1",
    attemptNumber: 1,
    submittedAt: "2026-09-13T00:00:00.000Z",
    candidate: { id: "c", firstName: "Asha", lastName: "Patel", email: "a@x.io", phoneE164: null },
    organization: { id: "org", name: "Org" },
    assessment: {
      id: "v",
      title: "Career Profile",
      versionNumber: 1,
      assessmentDefinition: { id: "d", code: "CP" },
    },
    generationStatus: "GENERATED",
    generation: null,
    candidateEntitlementStatus: "NONE",
    counsellors: [],
    thirdPartyAccess: { activeGrantCount: 0, organizationAccess: false, counsellorAccess: false },
    canViewFullReport: false,
    canDownloadReport: false,
    canRetryGeneration: false,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("R20-C2c staff unlock offers respect the backend access state", () => {
  it("hides every unlock when the report is not generated, the wallet is inactive or empty, or access already exists", () => {
    expect(
      canOfferUnlock({
        generationStatus: "PENDING",
        canViewFullReport: false,
        walletStatus: "ACTIVE",
        balance: 5,
      }),
    ).toBe(false);
    expect(
      canOfferUnlock({
        generationStatus: "GENERATED",
        canViewFullReport: true,
        walletStatus: "ACTIVE",
        balance: 5,
      }),
    ).toBe(false);
    expect(
      canOfferUnlock({
        generationStatus: "GENERATED",
        canViewFullReport: false,
        walletStatus: "SUSPENDED",
        balance: 5,
      }),
    ).toBe(false);
    expect(
      canOfferUnlock({
        generationStatus: "GENERATED",
        canViewFullReport: false,
        walletStatus: "ACTIVE",
        balance: 0,
      }),
    ).toBe(false);
    expect(
      canOfferUnlock({
        generationStatus: "GENERATED",
        canViewFullReport: false,
        walletStatus: "ACTIVE",
        balance: 1,
      }),
    ).toBe(true);
  });

  it("offers a tenant administrator separate organization and sponsored-candidate actions, one credit each", () => {
    const offers = unlockOffers("ORGANIZATION_ADMIN", item(), wallet());
    expect(offers.map((offer) => offer.mode)).toEqual(["ORGANIZATION", "CANDIDATE"]);
    expect(offers[0]?.label).toBe("Unlock for organization — 1 credit");
    expect(offers[1]?.label).toBe("Sponsor candidate access — 1 credit");
    // Organisation already granted: only the explicit candidate sponsorship remains.
    expect(
      unlockOffers("ORGANIZATION_ADMIN", item({ canViewFullReport: true }), wallet()).map(
        (offer) => offer.mode,
      ),
    ).toEqual(["CANDIDATE"]);
    // Candidate already entitled: sponsorship is not offered.
    expect(
      unlockOffers(
        "ORGANIZATION_ADMIN",
        item({ candidateEntitlementStatus: "ACTIVE" }),
        wallet(),
      ).map((offer) => offer.mode),
    ).toEqual(["ORGANIZATION"]);
  });

  it("offers a counsellor only the own-wallet unlock and nothing to other roles", () => {
    const userWallet = wallet({ ownerType: "USER", ownerUserId: "u", ownerOrganizationId: null });
    const offers = unlockOffers("COUNSELLOR", item(), userWallet);
    expect(offers.map((offer) => offer.mode)).toEqual(["COUNSELLOR"]);
    expect(offers[0]?.label).toBe("Unlock for me — 1 credit");
    expect(unlockOffers(undefined, item(), userWallet)).toEqual([]);
    expect(unlockOffers("COUNSELLOR", item(), null)).toEqual([]);
    expect(staffRoleOf("PLATFORM_ADMIN")).toBeUndefined();
    expect(staffRoleOf("COUNSELLOR")).toBe("COUNSELLOR");
  });

  it("renders no unlock control for a closed wallet and shows the wallet balance", () => {
    const closed = wallet({ status: "CLOSED", currentBalance: 4 });
    const actions = renderToStaticMarkup(
      <UnlockActions
        role="ORGANIZATION_ADMIN"
        item={item()}
        wallet={closed}
        onUnlocked={() => {}}
      />,
    );
    expect(actions).toBe("");
    const badge = renderToStaticMarkup(
      <WalletBalanceBadge wallet={closed} error="" role="ORGANIZATION_ADMIN" />,
    );
    expect(badge).toContain("Organization wallet");
    expect(badge).toContain("4 credits");
    expect(badge).toContain("CLOSED");
    const open = renderToStaticMarkup(
      <UnlockActions
        role="COUNSELLOR"
        item={item()}
        wallet={wallet({ ownerType: "USER" })}
        onUnlocked={() => {}}
      />,
    );
    expect(open).toContain("Unlock for me — 1 credit");
    expect(open).not.toContain("Sponsor candidate");
  });

  it("labels per-item bulk outcomes as charged, already granted or skipped with the server reason", () => {
    expect(unlockStatusLabel("charged")).toBe("Unlocked · 1 credit");
    expect(unlockStatusLabel("already_granted")).toBe("Already granted · no charge");
    expect(unlockStatusLabel("skipped:INSUFFICIENT_BALANCE")).toBe(
      "Skipped · insufficient balance",
    );
  });
});

describe("R20-C2c staff pages", () => {
  it("re-fetches the server access state after an unlock instead of assuming a grant", () => {
    const detail = source(pages.staffReport);
    expect(detail).toContain("await Promise.all([load(), staffWallet.reload()])");
    expect(detail).toContain('detail.canViewFullReport && detail.generationStatus === "GENERATED"');
    expect(detail).toContain("<UnlockActions");
    const list = source(pages.staffReports);
    expect(list).toContain("reportCreditsApi.bulkUnlock({ attemptIds, mode: bulkMode })");
    expect(list).toContain("const BULK_CAP = 200");
    expect(list).toContain('<option value="ORGANIZATION">Organization access');
    expect(list).toContain('<option value="CANDIDATE">Sponsored candidate access');
    expect(list).not.toContain('value="COUNSELLOR"');
    expect(list).toContain("already granted");
  });

  it("keeps staff navigation to Reports and Credits", () => {
    const shell = source(pages.staffShell);
    expect(shell).toContain('{ href: "/staff/reports", label: "Reports" }');
    expect(shell).toContain('{ href: "/staff/credits", label: "Credits" }');
  });

  it("shows candidate entitlement source in Candidate 360 and the wallet on organization detail", () => {
    expect(source(pages.candidate360)).toContain("sponsored by organization credit");
    expect(source(pages.organizationDetail)).toContain("<OrganizationCreditWallet");
    const admin = source(pages.adminCredits);
    expect(admin).toContain('<AdminRoute permission="report.credit.view">');
    expect(admin).toContain("Organization name, or counsellor name / mobile / email.");
    const walletPage = source(pages.adminWallet);
    expect(walletPage).toContain("revoke");
    expect(walletPage).toContain("transfer");
    expect(walletPage).toContain("status");
  });
});

describe("R20-C2c self-service purchase never sends an authoritative amount", () => {
  it("submits only product code, quantity and coupon; the server returns price, tax and total", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/csrf"))
        return new Response(JSON.stringify({ csrfToken: "t" }), { status: 200 });
      if (init?.method === "POST")
        return new Response(
          JSON.stringify({
            id: "o",
            status: "PENDING",
            currency: "INR",
            subtotalMinor: 1000000,
            discountMinor: 0,
            taxMinor: 180000,
            totalMinor: 1180000,
            quantity: 2,
            credits: 20,
            paymentRequired: true,
          }),
          { status: 200 },
        );
      return new Response("[]", { status: 200 });
    });
    const order = await reportCreditsApi.createOrder({ productCode: "PACK_10", quantity: 2 });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(String(post[0])).toBe(`${API_BASE_URL}/staff/commerce/orders`);
    const body = JSON.parse(String(post[1]?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["productCode", "quantity"]);
    expect(body).not.toHaveProperty("totalMinor");
    expect(body).not.toHaveProperty("priceMinor");
    expect(order.totalMinor).toBe(1180000);
    const page = source(pages.staffCredits);
    expect(page).toContain(
      "Final amount, coupon and tax are confirmed by the server on the order.",
    );
    expect(page).not.toMatch(/createOrder\([^)]*(priceMinor|totalMinor|amount)/);
  });

  it("targets the staff self-service endpoints with derived purchaser and idempotent transfers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) =>
        String(input).endsWith("/auth/csrf")
          ? new Response(JSON.stringify({ csrfToken: "t" }), { status: 200 })
          : new Response("{}", { status: 200 }),
      );
    await reportCreditsApi.myWallet();
    await reportCreditsApi.creditPacks();
    await reportCreditsApi.unlock({ attemptId: "a", mode: "ORGANIZATION" });
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toContain(`${API_BASE_URL}/staff/report-credits/wallet`);
    expect(urls).toContain(`${API_BASE_URL}/staff/commerce/credit-packs`);
    expect(urls).toContain(`${API_BASE_URL}/staff/report-credits/unlock`);
    const unlockCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/staff/report-credits/unlock"),
    )!;
    // No walletId, principal or user id is ever sent by staff: the server derives them.
    expect(JSON.parse(String(unlockCall[1]?.body))).toEqual({
      attemptId: "a",
      mode: "ORGANIZATION",
    });
    expect(source(pages.staffCredits)).toContain("transferKey: crypto.randomUUID()");
  });
});
