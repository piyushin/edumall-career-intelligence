"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../../../lib/api";
import {
  getAssessmentResult,
  type AssessmentResultDetail,
} from "../../../../lib/assessment-results";

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ResultDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId") ?? undefined;

  const [result, setResult] = useState<AssessmentResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setResult(await getAssessmentResult(params.attemptId, organizationId));
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : "Unable to load this result.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.attemptId, organizationId]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading result...</p>;
  }

  if (!result) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  const version = result.assignment.assessmentVersion;

  return (
    <div className="space-y-8">
      <Link
        href={`/staff/results${
          organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
        }`}
        className="text-sm font-medium text-blue-700"
      >
        ← Assessment Results
      </Link>

      <header>
        <h1 className="text-3xl font-semibold text-slate-950">
          {result.assignment.user.firstName} {result.assignment.user.lastName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {version.title} · {version.assessmentDefinition.code} · v{version.versionNumber}
        </p>
        <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(result.submittedAt)}</p>
      </header>

      {!result.scoring ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-slate-950">Scoring data unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">
            The assessment is submitted, but no deterministic scoring run is available for review.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Technical scoring provenance</h2>
            <dl className="mt-5 grid gap-5 text-sm md:grid-cols-2">
              <div>
                <dt className="text-slate-500">Scoring version</dt>
                <dd className="mt-1 font-medium text-slate-800">{result.scoring.scoringVersion}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Algorithm</dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {result.scoring.algorithmVersion}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Calculated</dt>
                <dd className="mt-1 font-medium text-slate-800">
                  {formatDate(result.scoring.calculatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Input hash</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                  {result.scoring.inputHash}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-950">Raw construct scores</h2>
              <p className="mt-2 text-sm text-slate-600">
                These are deterministic technical raw scores. They are not percentile ranks,
                diagnoses, career recommendations, or psychometric interpretations.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {result.scoring.constructs.map((construct) => (
                <div
                  key={construct.assessmentConstructId}
                  className="grid gap-3 p-6 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{construct.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {construct.code} · {construct.answeredItemCount} answered items ·{" "}
                      {construct.contributionCount} scoring contributions
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-slate-950">{construct.rawScore}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section
        className={`rounded-2xl border p-6 ${
          result.reportSnapshot
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <h2 className="text-lg font-semibold text-slate-950">Interpretive report status</h2>

        {result.reportSnapshot ? (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              A structured report-data snapshot exists for this scoring run. Phase 5A intentionally
              does not render its interpretation content until the approved scientific reporting
              workflow is enabled.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Report version {result.reportSnapshot.reportVersion} · Generated{" "}
              {formatDate(result.reportSnapshot.generatedAt)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-700">
            No scientifically governed interpretive report snapshot is currently available. Raw
            scores above must not be presented as normative or career recommendations.
          </p>
        )}
      </section>
    </div>
  );
}
