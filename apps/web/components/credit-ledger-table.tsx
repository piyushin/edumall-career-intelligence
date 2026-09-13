"use client";

import Link from "next/link";
import { formatDate, StatusBadge } from "./admin-ui";
import type { LedgerEntry } from "../lib/report-credits";

function principalLabel(entry: LedgerEntry): string {
  if (entry.entitlement) return "Candidate (sponsored)";
  if (entry.reportAccessGrant)
    return entry.reportAccessGrant.principalType === "ORGANIZATION" ? "Organization" : "Counsellor";
  if (entry.principalKey) return entry.principalKey.split(":")[0] ?? "";
  return "";
}

// Immutable ledger rows with their evidence: order, attempt/candidate, grant or
// entitlement, transfer id, actor and reference.
export function LedgerTable({
  entries,
  admin = true,
}: {
  entries: LedgerEntry[];
  admin?: boolean;
}) {
  if (entries.length === 0) return <p className="text-sm text-slate-600">No ledger entries yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Δ</th>
            <th className="px-3 py-2">Balance</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2">Actor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="align-top">
              <td className="px-3 py-2 text-xs">{formatDate(entry.createdAt)}</td>
              <td className="px-3 py-2">
                <StatusBadge value={entry.eventType} />
              </td>
              <td className="px-3 py-2 font-semibold">
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </td>
              <td className="px-3 py-2">{entry.balanceAfter}</td>
              <td className="px-3 py-2 text-xs">
                {entry.order ? (
                  admin ? (
                    <Link
                      href={`/admin/commerce/orders/${entry.order.id}`}
                      className="font-medium text-red-700 hover:underline"
                    >
                      Order · {entry.order.product.code}
                    </Link>
                  ) : (
                    <span>Order · {entry.order.product.code}</span>
                  )
                ) : null}
                {entry.attempt ? (
                  <p>
                    {principalLabel(entry)} ·{" "}
                    {admin ? (
                      <Link
                        href={`/admin/reports/${entry.attempt.id}`}
                        className="font-medium text-red-700 hover:underline"
                      >
                        {entry.attempt.assignment.user.firstName}{" "}
                        {entry.attempt.assignment.user.lastName}
                      </Link>
                    ) : (
                      <Link
                        href={`/staff/reports/${entry.attempt.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {entry.attempt.assignment.user.firstName}{" "}
                        {entry.attempt.assignment.user.lastName}
                      </Link>
                    )}
                  </p>
                ) : null}
                {entry.transferId ? (
                  <p className="text-slate-500">Transfer {entry.transferId.slice(0, 8)}…</p>
                ) : null}
              </td>
              <td className="px-3 py-2 text-xs">{entry.reference ?? "—"}</td>
              <td className="px-3 py-2 text-xs">
                {entry.actorUser ? `${entry.actorUser.firstName} ${entry.actorUser.lastName}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
