"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import { getSession, type AuthSession } from "../../../lib/auth";
import {
  listReportReleases,
  type ReportReleaseListItem,
  type ReportReleaseStatus,
} from "../../../lib/report-reviews";

const STATUS_LABELS: Record<ReportReleaseStatus, string> = {
  PENDING_REVIEW: "Awaiting review",
  RELEASED: "Released",
  WITHDRAWN: "Withdrawn",
};

const STATUS_STYLES: Record<ReportReleaseStatus, string> = {
  PENDING_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
  RELEASED: "bg-green-50 text-green-800 border-green-200",
  WITHDRAWN: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CounsellorReportsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [status, setStatus] = useState<ReportReleaseStatus | "">("");
  const [releases, setReleases] = useState<ReportReleaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isSuperAdmin = session?.session.role === "SUPER_ADMIN";

  async function load(orgOverride?: string) {
    setLoading(true);
    setError("");

    try {
      const auth = session ?? (await getSession());

      if (!session) {
        setSession(auth);
      }

      const scopedOrganizationId =
        auth.session.role === "SUPER_ADMIN" ? (orgOverride ?? organizationId).trim() : undefined;

      if (auth.session.role === "SUPER_ADMIN" && !scopedOrganizationId) {
        setReleases([]);
        return;
      }

      const items = await listReportReleases(
        scopedOrganizationId,
        status === "" ? undefined : status,
      );

      setReleases(items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load report reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Report reviews</h1>
        <p className="mt-1 text-sm text-slate-600">
          Assessments awaiting counsellor review before release to the candidate.
        </p>
      </div>

      {isSuperAdmin ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Organization ID</span>
            <input
              type="text"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="mt-2 w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Load
          </button>
        </div>
      ) : null}

      <div className="flex gap-2">
        {(["", "PENDING_REVIEW", "RELEASED", "WITHDRAWN"] as const).map((option) => (
          <button
            key={option || "ALL"}
            type="button"
            onClick={() => setStatus(option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              status === option
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option === "" ? "All" : STATUS_LABELS[option]}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading report reviews...</p>
      ) : releases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {isSuperAdmin && !organizationId.trim()
            ? "Enter an organization ID to load its report reviews."
            : "No reports match this filter."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Assessment</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {releases.map((release) => {
                const candidate = release.attempt.assignment.user;
                const version = release.attempt.assignment.assessmentVersion;

                return (
                  <tr key={release.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {candidate.firstName} {candidate.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{candidate.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {version.title} · {version.edition} ({version.form})
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(release.attempt.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[release.status]}`}
                      >
                        {STATUS_LABELS[release.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/counsellor/reports/${release.attemptId}`}
                        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
