"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GeneratedReportView } from "../../../../components/generated-report-view";
import {
  UnlockActions,
  WalletBalanceBadge,
  staffRoleOf,
  useStaffWallet,
} from "../../../../components/report-unlock-actions";
import { useStaffSession } from "../../../../components/staff-shell";
import { ApiError } from "../../../../lib/api";
import {
  reportPlatformApi,
  type OpenedReport,
  type ReportSearchItem,
} from "../../../../lib/report-platform";

export default function StaffReportDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const session = useStaffSession();
  const role = staffRoleOf(session?.session.role);
  const staffWallet = useStaffWallet(role);
  const [record, setRecord] = useState<ReportSearchItem | null>(null);
  const [report, setReport] = useState<OpenedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The access state is always re-read from the server; the page never assumes
  // a grant exists because a button was clicked.
  const load = useCallback(async () => {
    try {
      const detail = await reportPlatformApi.staffDetail(attemptId);
      setRecord(detail);
      if (detail.canViewFullReport && detail.generationStatus === "GENERATED")
        setReport(await reportPlatformApi.staffFull(attemptId));
      else setReport(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [attemptId]);
  useEffect(() => void load(), [load]);
  if (loading)
    return (
      <p aria-busy="true" className="text-sm text-slate-600">
        Loading report…
      </p>
    );
  if (error || !record)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
      >
        {error || "Report unavailable."}
      </div>
    );
  const status = record.generationStatus ?? "PENDING";
  return (
    <div className="space-y-7">
      <Link href="/staff/reports" className="text-sm font-medium text-blue-700">
        ← Reports
      </Link>
      <header>
        <h1 className="text-3xl font-semibold text-slate-950">
          {record.candidate.firstName} {record.candidate.lastName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {record.assessment.title} · {record.organization.name}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Submitted {record.submittedAt ? new Date(record.submittedAt).toLocaleString() : "—"}
        </p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Automatic report status</h2>
        <p className="mt-3 text-sm font-semibold">
          {status === "BLOCKED_CONFIGURATION"
            ? "Configuration required"
            : status === "FAILED"
              ? "Generation failed"
              : status === "GENERATED"
                ? "Generated"
                : "Processing"}
        </p>
        {record.generation?.lastErrorMessage ? (
          <p className="mt-2 text-sm text-red-700">{record.generation.lastErrorMessage}</p>
        ) : null}
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Candidate access</dt>
            <dd className="font-medium">
              {record.candidateEntitlementStatus === "ACTIVE" ? "Unlocked" : "Locked"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Record visible</dt>
            <dd className="font-medium">Yes</dd>
          </div>
          <div>
            <dt className="text-slate-500">Full report access</dt>
            <dd className="font-medium">
              {record.canViewFullReport ? "Allowed" : "Report access required"}
            </dd>
          </div>
        </dl>
      </section>
      {status === "GENERATED" && !record.canViewFullReport ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Report access required.</strong> Your assignment or tenant scope allows this
          record to be found, but a separate active report-access grant is required to open the
          complete report.
        </div>
      ) : null}
      {role && status === "GENERATED" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Report credits</h2>
          <p className="mt-1 text-sm text-slate-600">
            One credit = one full-report grant for one attempt to one principal. Each action below
            is a separate, explicit unlock.
          </p>
          <div className="mt-3">
            <WalletBalanceBadge wallet={staffWallet.wallet} error={staffWallet.error} role={role} />
          </div>
          <div className="mt-4">
            <UnlockActions
              role={role}
              item={record}
              wallet={staffWallet.wallet}
              onUnlocked={async () => {
                await Promise.all([load(), staffWallet.reload()]);
              }}
            />
          </div>
        </section>
      ) : null}
      {report ? (
        <GeneratedReportView
          payload={report.report.payload}
          generatedAt={report.report.generatedAt}
          reportVersion={report.report.reportVersion}
        />
      ) : null}
    </div>
  );
}
