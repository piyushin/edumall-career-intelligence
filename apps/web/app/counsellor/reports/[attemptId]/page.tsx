"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../../../../lib/api";
import { getSession, type AuthSession } from "../../../../lib/auth";
import {
  addCounsellorNote,
  getReportReleaseDetail,
  releaseReport,
  withdrawReport,
  type ReportReleaseDetail,
} from "../../../../lib/report-reviews";

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Awaiting review",
  RELEASED: "Released",
  WITHDRAWN: "Withdrawn",
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

function formatOutputData(value: unknown): string {
  if (value && typeof value === "object" && "band" in value) {
    const band = (value as { band?: unknown }).band;

    if (typeof band === "string") {
      return band;
    }
  }

  return JSON.stringify(value);
}

export default function CounsellorReportDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [detail, setDetail] = useState<ReportReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [acting, setActing] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const canAct = session?.session.role === "COUNSELLOR" || session?.session.role === "SUPER_ADMIN";

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [auth, reportDetail] = await Promise.all([
        getSession(),
        getReportReleaseDetail(attemptId),
      ]);

      setSession(auth);
      setDetail(reportDetail);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load this report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [attemptId]);

  async function handleRelease() {
    setActing(true);
    setError("");
    setMessage("");

    try {
      await releaseReport(attemptId);
      setMessage("Report released to the candidate.");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to release this report.");
    } finally {
      setActing(false);
    }
  }

  async function handleWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActing(true);
    setError("");
    setMessage("");

    try {
      await withdrawReport(attemptId, withdrawReason.trim());
      setMessage("Report withdrawn.");
      setShowWithdrawForm(false);
      setWithdrawReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to withdraw this report.");
    } finally {
      setActing(false);
    }
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!noteBody.trim()) {
      return;
    }

    setAddingNote(true);
    setError("");

    try {
      await addCounsellorNote(attemptId, noteBody.trim());
      setNoteBody("");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to add this note.");
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading report...</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
        <Link href="/counsellor/reports" className="text-sm font-semibold text-blue-700">
          Back to report reviews
        </Link>
      </div>
    );
  }

  const candidate = detail.attempt.assignment.user;
  const version = detail.attempt.assignment.assessmentVersion;

  return (
    <div className="space-y-6">
      <Link href="/counsellor/reports" className="text-sm font-semibold text-blue-700">
        ← Back to report reviews
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              {candidate.firstName} {candidate.lastName}
            </h1>
            <p className="text-sm text-slate-600">{candidate.email}</p>
            <p className="mt-2 text-sm text-slate-700">
              {version.title} · {version.edition} ({version.form}) · v{version.versionNumber}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Submitted {formatDate(detail.attempt.submittedAt)}
            </p>
          </div>
          <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700">
            {STATUS_LABELS[detail.status] ?? detail.status}
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        ) : null}

        {canAct ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {detail.status === "PENDING_REVIEW" ? (
              <Button onClick={handleRelease} disabled={acting}>
                {acting ? "Releasing..." : "Release to candidate"}
              </Button>
            ) : null}

            {detail.status === "RELEASED" && !showWithdrawForm ? (
              <Button variant="secondary" onClick={() => setShowWithdrawForm(true)}>
                Withdraw report
              </Button>
            ) : null}
          </div>
        ) : null}

        {showWithdrawForm ? (
          <form
            onSubmit={handleWithdraw}
            className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4"
          >
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Reason for withdrawal</span>
              <textarea
                required
                minLength={1}
                maxLength={2000}
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                rows={3}
              />
            </label>
            <div className="flex gap-3">
              <Button type="submit" disabled={acting}>
                {acting ? "Withdrawing..." : "Confirm withdrawal"}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setShowWithdrawForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Construct results</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Construct</th>
                <th className="px-4 py-2">Raw score</th>
                <th className="px-4 py-2">Percentile</th>
                <th className="px-4 py-2">Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.reportDataSnapshot.payload.scoring.constructs.map((construct) => {
                const norm = detail.reportDataSnapshot.payload.norms.find(
                  (entry) => entry.assessmentConstructId === construct.assessmentConstructId,
                );
                const application =
                  detail.reportDataSnapshot.payload.interpretation.applications.find(
                    (entry) => entry.assessmentConstructId === construct.assessmentConstructId,
                  );

                return (
                  <tr key={construct.assessmentConstructId}>
                    <td className="px-4 py-2 font-medium text-slate-900">{construct.name}</td>
                    <td className="px-4 py-2 text-slate-700">{construct.rawScore}</td>
                    <td className="px-4 py-2 text-slate-700">{norm?.percentile ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {application ? formatOutputData(application.outputData) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Counsellor notes</h2>
        <p className="mt-1 text-xs text-slate-500">
          Private to counsellors and administrators. Never shown to the candidate.
        </p>

        <ul className="mt-4 space-y-3">
          {detail.notes.length === 0 ? (
            <li className="text-sm text-slate-500">No notes yet.</li>
          ) : (
            detail.notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{note.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {note.authorUser.firstName} {note.authorUser.lastName} ·{" "}
                  {formatDate(note.createdAt)}
                </p>
              </li>
            ))
          )}
        </ul>

        {canAct ? (
          <form onSubmit={handleAddNote} className="mt-4 space-y-3">
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Add a private note..."
              maxLength={10000}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <Button type="submit" disabled={addingNote || !noteBody.trim()}>
              {addingNote ? "Adding..." : "Add note"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
