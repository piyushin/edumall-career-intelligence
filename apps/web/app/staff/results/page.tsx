"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/api";
import {
  listAssessmentResults,
  type AssessmentResultSummary,
} from "../../../lib/assessment-results";
import { getSession } from "../../../lib/auth";

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ResultsPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [results, setResults] = useState<AssessmentResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const session = await getSession();
        const platformAdmin = session.session.role === "SUPER_ADMIN";
        setIsSuperAdmin(platformAdmin);

        if (!platformAdmin) {
          setResults(await listAssessmentResults());
        }
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : "Unable to load assessment results.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function loadOrganizationResults() {
    if (!organizationId.trim()) return;

    setLoadingResults(true);
    setError("");

    try {
      setResults(await listAssessmentResults(organizationId.trim()));
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to load organization results.",
      );
    } finally {
      setLoadingResults(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading results...</p>;
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Counselor review
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Assessment Results</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Review submitted assessments and deterministic raw scoring data. Normative interpretation
          is shown only after scientifically approved report data is available.
        </p>
      </header>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Select organization</p>
          <div className="mt-3 flex gap-3">
            <input
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              placeholder="Organization UUID"
              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
            <button
              type="button"
              disabled={!organizationId.trim() || loadingResults}
              onClick={() => void loadOrganizationResults()}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loadingResults ? "Loading..." : "Load"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {results.length === 0 ? (
          <div className="p-8 text-sm text-slate-600">
            {isSuperAdmin && !organizationId.trim()
              ? "Select an organization to view results."
              : "No submitted assessment results are available."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {results.map((result) => (
              <article key={result.id} className="p-6">
                <div className="flex flex-col justify-between gap-5 lg:flex-row">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {result.assignment.user.firstName} {result.assignment.user.lastName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {result.assignment.assessmentVersion.title} ·{" "}
                      {result.assignment.assessmentVersion.assessmentDefinition.code}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Submitted {formatDate(result.submittedAt)} · Attempt {result.attemptNumber}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {result.scoring
                          ? `${result.scoring.constructCount} scored constructs`
                          : "Scoring unavailable"}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          result.reportSnapshot
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {result.reportSnapshot
                          ? "Report data available"
                          : "Interpretive report not available"}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/staff/results/${result.id}${
                      isSuperAdmin
                        ? `?organizationId=${encodeURIComponent(organizationId.trim())}`
                        : ""
                    }`}
                    className="h-fit rounded-lg bg-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Review result
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
