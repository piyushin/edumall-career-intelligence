"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import {
  canOfferUnlock,
  reportCreditsApi,
  unlockStatusLabel,
  type MyWallet,
  type UnlockMode,
  type UnlockResult,
} from "../lib/report-credits";
import type { ReportSearchItem } from "../lib/report-platform";

export type StaffRole = "ORGANIZATION_ADMIN" | "COUNSELLOR";

export function staffRoleOf(role: string | undefined): StaffRole | undefined {
  return role === "ORGANIZATION_ADMIN" || role === "COUNSELLOR" ? role : undefined;
}

// The staff wallet is loaded once per page; the backend creates it on first use
// so tenant administrators and counsellors always have a balance to show.
export function useStaffWallet(role: string | undefined) {
  const [wallet, setWallet] = useState<MyWallet | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (role !== "ORGANIZATION_ADMIN" && role !== "COUNSELLOR") return;
    try {
      setWallet(await reportCreditsApi.myWallet());
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Wallet could not be loaded.");
    }
  }, [role]);
  useEffect(() => void reload(), [reload]);
  return { wallet, error, reload };
}

export interface UnlockOffer {
  mode: UnlockMode;
  label: string;
  description: string;
}

// Which explicit unlock actions a role may be offered for one visible row. The
// backend re-derives every condition; this only hides actions that cannot
// succeed (report not generated, wallet inactive, no balance, already granted).
export function unlockOffers(
  role: StaffRole | undefined,
  item: Pick<
    ReportSearchItem,
    "generationStatus" | "canViewFullReport" | "candidateEntitlementStatus"
  >,
  wallet: MyWallet | null,
): UnlockOffer[] {
  if (!role || !wallet) return [];
  const base = {
    generationStatus: item.generationStatus,
    walletStatus: wallet.wallet.status,
    balance: wallet.wallet.currentBalance,
  };
  const offers: UnlockOffer[] = [];
  if (role === "COUNSELLOR") {
    if (canOfferUnlock({ ...base, canViewFullReport: item.canViewFullReport })) {
      offers.push({
        mode: "COUNSELLOR",
        label: "Unlock for me — 1 credit",
        description: "Grants you (the counsellor) access to this complete report.",
      });
    }
    return offers;
  }
  if (canOfferUnlock({ ...base, canViewFullReport: item.canViewFullReport })) {
    offers.push({
      mode: "ORGANIZATION",
      label: "Unlock for organization — 1 credit",
      description: "Grants your organization access. Candidate access is unchanged.",
    });
  }
  if (
    canOfferUnlock({ ...base, canViewFullReport: item.candidateEntitlementStatus === "ACTIVE" })
  ) {
    offers.push({
      mode: "CANDIDATE",
      label: "Sponsor candidate access — 1 credit",
      description:
        "Grants the candidate their own complete report. Organization access is unchanged.",
    });
  }
  return offers;
}

export function WalletBalanceBadge({
  wallet,
  error,
  role,
}: {
  wallet: MyWallet | null;
  error: string;
  role: StaffRole | undefined;
}) {
  if (!role) return null;
  if (error)
    return (
      <p role="alert" className="text-xs text-red-700">
        {error}
      </p>
    );
  if (!wallet)
    return (
      <p className="text-xs text-slate-500" aria-busy="true">
        Loading wallet…
      </p>
    );
  return (
    <p className="text-sm text-slate-700">
      <span className="font-semibold">
        {role === "ORGANIZATION_ADMIN" ? "Organization wallet" : "My wallet"}
      </span>{" "}
      · {wallet.wallet.currentBalance} credit{wallet.wallet.currentBalance === 1 ? "" : "s"}
      {wallet.wallet.status !== "ACTIVE" ? (
        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          {wallet.wallet.status}
        </span>
      ) : null}
      <Link
        href="/staff/credits"
        className="ml-3 text-xs font-medium text-blue-700 hover:underline"
      >
        Manage credits
      </Link>
    </p>
  );
}

// Explicit single-attempt unlock buttons. One click = one credit = one
// principal; the mode is explicit and the principal is derived server-side.
export function UnlockActions({
  role,
  item,
  wallet,
  compact = false,
  onUnlocked,
}: {
  role: StaffRole | undefined;
  item: ReportSearchItem;
  wallet: MyWallet | null;
  compact?: boolean;
  onUnlocked: (result: UnlockResult) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<UnlockMode | null>(null);
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState("");
  const offers = unlockOffers(role, item, wallet);
  if (offers.length === 0 && !outcome && !error) return null;

  async function unlock(offer: UnlockOffer) {
    if (
      !window.confirm(
        `${offer.label}\n\n${offer.description}\n\nThis consumes exactly one credit for this attempt.`,
      )
    )
      return;
    setBusy(offer.mode);
    setError("");
    setOutcome("");
    try {
      const result = await reportCreditsApi.unlock({ attemptId: item.attemptId, mode: offer.mode });
      setOutcome(unlockStatusLabel(result.status));
      await onUnlocked(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unlock failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-wrap items-start gap-3"}>
      {offers.map((offer) => (
        <button
          key={offer.mode}
          type="button"
          disabled={busy !== null}
          onClick={() => void unlock(offer)}
          title={offer.description}
          className={
            compact
              ? "text-left text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50"
              : offer.mode === "CANDIDATE"
                ? "rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
                : "rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          }
        >
          {busy === offer.mode ? "Unlocking…" : offer.label}
        </button>
      ))}
      {outcome ? (
        <p role="status" className="text-xs text-emerald-700">
          {outcome}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
