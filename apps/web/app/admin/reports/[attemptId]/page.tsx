"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@edumall/ui";
import { AdminRoute } from "../../../../components/admin-route";
import { GeneratedReportView } from "../../../../components/generated-report-view";
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
} from "../../../../components/admin-ui";
import { ApiError } from "../../../../lib/api";
import {
  reportPlatformApi,
  type OpenedReport,
  type ReportSearchItem,
} from "../../../../lib/report-platform";

export default function AdminReportDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [record, setRecord] = useState<ReportSearchItem | null>(null);
  const [opened, setOpened] = useState<OpenedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await reportPlatformApi.adminDetail(attemptId);
      setRecord(detail);
      setOpened(
        detail.generationStatus === "GENERATED" && detail.canViewFullReport
          ? await reportPlatformApi.adminFull(attemptId)
          : null,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [attemptId]);
  useEffect(() => void load(), [load]);

  async function retry() {
    setBusy(true);
    setActionError("");
    try {
      await reportPlatformApi.adminRetry(attemptId);
      await load();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "Generation retry failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setActionError("");
    try {
      const file = await reportPlatformApi.adminPdf(attemptId);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : "PDF download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminRoute permission="report.search">
      {loading ? (
        <LoadingSkeleton rows={9} />
      ) : error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : !record ? (
        <EmptyState
          title="Report not found"
          description="No report record is visible in your authorized scope."
        />
      ) : (
        <div className="space-y-7">
          <Link href="/admin/reports" className="text-sm font-medium text-red-700 hover:underline">
            ← Reports
          </Link>
          <PageHeader
            eyebrow="Report record"
            title={`${record.candidate.firstName} ${record.candidate.lastName}`}
            description={`${record.assessment.title} · Submitted ${formatDate(record.submittedAt)}`}
            actions={
              <>
                {record.canDownloadReport && opened ? (
                  <Button variant="secondary" disabled={busy} onClick={() => void download()}>
                    Download PDF
                  </Button>
                ) : null}
                {record.canRetryGeneration ? (
                  <Button disabled={busy} onClick={() => void retry()}>
                    Retry generation
                  </Button>
                ) : null}
              </>
            }
          />
          {actionError ? <Alert>{actionError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Panel>
              <p className="text-sm text-slate-500">Generation</p>
              <div className="mt-3">
                <StatusBadge value={record.generationStatus ?? "PENDING"} />
              </div>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Candidate detailed access</p>
              <div className="mt-3">
                <StatusBadge
                  value={record.candidateEntitlementStatus === "ACTIVE" ? "UNLOCKED" : "LOCKED"}
                />
              </div>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Tenant access</p>
              <p className="mt-2 font-semibold">
                {record.thirdPartyAccess.organizationAccess ? "Granted" : "No active grant"}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-slate-500">Counsellor access</p>
              <p className="mt-2 font-semibold">
                {record.thirdPartyAccess.counsellorAccess ? "Granted" : "No active grant"}
              </p>
            </Panel>
          </div>
          <Panel>
            <h2 className="text-lg font-semibold text-slate-950">Candidate and assessment</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-slate-500">Mobile</dt>
                <dd className="mt-1 font-medium">{record.candidate.phoneE164 ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-1 font-medium">{record.candidate.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Tenant</dt>
                <dd className="mt-1 font-medium">{record.organization.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Assessment</dt>
                <dd className="mt-1 font-medium">
                  {record.assessment.title} · v{record.assessment.versionNumber}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Submitted</dt>
                <dd className="mt-1 font-medium">{formatDate(record.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Counsellor</dt>
                <dd className="mt-1 font-medium">
                  {record.counsellors.length
                    ? record.counsellors
                        .map((item) => `${item.firstName} ${item.lastName}`)
                        .join(", ")
                    : "Not assigned"}
                </dd>
              </div>
            </dl>
            <Link
              href={`/admin/users/${record.candidate.id}`}
              className="mt-5 inline-block text-sm font-medium text-red-700 hover:underline"
            >
              Open Candidate 360
            </Link>
          </Panel>
          {record.generationStatus === "BLOCKED_CONFIGURATION" ? (
            <Alert tone="warning">
              <strong>Configuration required.</strong>{" "}
              {record.generation?.lastErrorMessage ??
                "This assessment version is missing an active, published, compatible report configuration."}
            </Alert>
          ) : null}
          {record.generationStatus === "FAILED" ? (
            <Alert>
              <strong>Generation failed.</strong>{" "}
              {record.generation?.lastErrorMessage ??
                "An authorized central administrator can retry automatic processing."}
            </Alert>
          ) : null}
          {record.generationStatus === "PENDING" ||
          record.generationStatus === "PROCESSING" ||
          !record.generationStatus ? (
            <Alert tone="info">
              <strong>Processing.</strong> The detailed report is generated automatically after
              scoring and governed interpretation complete.
            </Alert>
          ) : null}
          {record.generationStatus === "GENERATED" && !record.canViewFullReport ? (
            <Alert tone="warning">
              <strong>Report access required.</strong> This record is visible, but your current
              authorization does not allow the complete report to be opened.
            </Alert>
          ) : null}
          {opened ? (
            <GeneratedReportView
              payload={opened.report.payload}
              generatedAt={opened.report.generatedAt}
              reportVersion={opened.report.reportVersion}
            />
          ) : null}
        </div>
      )}
    </AdminRoute>
  );
}
