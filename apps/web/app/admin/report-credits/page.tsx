"use client";

import Link from "next/link";
import { AdminRoute } from "../../../components/admin-route";
import { PageHeader, Panel } from "../../../components/admin-ui";

// Interim C2b route: wallet lookup, transfers, bulk consumption and self-service
// purchase arrive in C2c. Until then this page states what exists and where the
// current evidence lives instead of rendering a fake wallet workspace.
export default function ReportCreditsPage() {
  return (
    <AdminRoute permission="report.credit.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Commerce"
          title="Report Credits"
          description="One report credit is one full-report access grant for one assessment attempt to one principal (candidate, organization or counsellor)."
        />
        <Panel>
          <h2 className="text-lg font-semibold text-slate-950">Available now</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Credit-pack products and their platform cost are managed under{" "}
              <Link
                href="/admin/commerce/products"
                className="font-medium text-red-700 hover:underline"
              >
                Products &amp; Pricing
              </Link>
              .
            </li>
            <li>
              Credit-pack purchases, including institutional bank-transfer orders awaiting central
              approval, appear under{" "}
              <Link
                href="/admin/commerce/orders"
                className="font-medium text-red-700 hover:underline"
              >
                Orders &amp; Payments
              </Link>{" "}
              with their ledger movements.
            </li>
            <li>
              Per-attempt access grants and counsellor assignments are visible on each candidate's
              360 view.
            </li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold text-slate-950">Arriving in C2c</h2>
          <p className="mt-2 text-sm text-slate-600">
            Wallet lookup by organization or counsellor, ledger review, central complimentary
            allotment, organization → counsellor transfers, bulk consumption, candidate-principal
            unlocks and tenant/counsellor self-service credit purchase.
          </p>
        </Panel>
      </div>
    </AdminRoute>
  );
}
