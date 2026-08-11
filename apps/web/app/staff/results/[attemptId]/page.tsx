"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../../../lib/api";
import {
  downloadAssessmentReportPdf,
  generateAssessmentReportSnapshot,
  getAssessmentReportReadiness,
  getAssessmentResult,
  type AssessmentReportPayload,
  type AssessmentReportReadiness,
  type AssessmentResultDetail,
} from "../../../../lib/assessment-results";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function outputText(value: unknown): string {
  if (value === null || value === undefined) {
    return "No narrative output supplied.";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function ReportSnapshotView({
  payload,
  generatedAt,
  reportVersion,
}: {
  payload: AssessmentReportPayload;
  generatedAt: string;
  reportVersion: string;
}) {
  const normByConstruct = new Map(payload.norms.map((norm) => [norm.assessmentConstructId, norm]));

  const interpretationByConstruct = new Map(
    payload.interpretation.applications.map((application) => [
      application.assessmentConstructId,
      application,
    ]),
  );

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">Governed report data available</p>
        <p className="mt-1 text-xs text-emerald-800">
          Report version {reportVersion} · Generated {formatDate(generatedAt)}
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-950">
          Normalized and interpreted construct results
        </h3>

        <div className="mt-4 space-y-4">
          {payload.scoring.constructs.map((construct) => {
            const norm = normByConstruct.get(construct.assessmentConstructId);

            const interpretation = interpretationByConstruct.get(construct.assessmentConstructId);

            return (
              <article
                key={construct.assessmentConstructId}
                className="rounded-xl border border-slate-200 p-5"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div>
                    <h4 className="font-semibold text-slate-950">{construct.name}</h4>
                    <p className="mt-1 text-xs text-slate-500">{construct.code}</p>
                  </div>

                  <dl className="grid grid-cols-3 gap-5 text-right text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Raw</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{construct.rawScore}</dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">Standardized</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {norm?.standardizedScore ?? "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">Percentile</dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {norm?.percentile ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-5 rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Published interpretation
                  </p>

                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                    {interpretation
                      ? outputText(interpretation.outputData)
                      : "No interpretation application is present."}
                  </pre>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        Interpretation set: {payload.interpretation.name} · {payload.interpretation.version}. This
        display is derived from the immutable report-data snapshot and its recorded scoring, norm,
        and interpretation provenance.
      </div>
    </div>
  );
}

export default function ResultDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const searchParams = useSearchParams();

  const organizationId = searchParams.get("organizationId") ?? undefined;

  const [result, setResult] = useState<AssessmentResultDetail | null>(null);

  const [reportReadiness, setReportReadiness] = useState<AssessmentReportReadiness | null>(null);

  const [normGroupId, setNormGroupId] = useState("");
  const [interpretationSetId, setInterpretationSetId] = useState("");

  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [loadedResult, readiness] = await Promise.all([
          getAssessmentResult(params.attemptId, organizationId),
          getAssessmentReportReadiness(params.attemptId, organizationId),
        ]);

        if (!active) {
          return;
        }

        setResult(loadedResult);
        setReportReadiness(readiness);

        if (readiness.publishedNormGroups.length === 1) {
          setNormGroupId(readiness.publishedNormGroups[0]?.id ?? "");
        }

        if (readiness.publishedInterpretationSets.length === 1) {
          setInterpretationSetId(readiness.publishedInterpretationSets[0]?.id ?? "");
        }
      } catch (caught) {
        if (!active) {
          return;
        }

        setError(caught instanceof ApiError ? caught.message : "Unable to load this result.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [params.attemptId, organizationId]);

  async function handleGenerateReport() {
    if (!normGroupId || !interpretationSetId) {
      setReportError("Select both a published norm group and a published interpretation set.");
      return;
    }

    setGeneratingReport(true);
    setReportError("");

    try {
      await generateAssessmentReportSnapshot(
        params.attemptId,
        {
          normGroupId,
          interpretationSetId,
        },
        organizationId,
      );

      const refreshed = await getAssessmentReportReadiness(params.attemptId, organizationId);

      setReportReadiness(refreshed);
    } catch (caught) {
      setReportError(
        caught instanceof ApiError ? caught.message : "Unable to generate governed report data.",
      );
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    setReportError("");

    try {
      const { blob, filename } = await downloadAssessmentReportPdf(
        params.attemptId,
        organizationId,
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (caught) {
      setReportError(
        caught instanceof ApiError ? caught.message : "Unable to download the assessment PDF.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading result...</p>;
  }

  if (!result) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8">
        <p className="text-sm text-red-700">{error || "Assessment result unavailable."}</p>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Governed report workflow</h2>

        {!reportReadiness ? (
          <p className="mt-3 text-sm text-slate-600">Report readiness could not be determined.</p>
        ) : reportReadiness.status === "SCORING_UNAVAILABLE" ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Report generation cannot begin until deterministic scoring is available.
          </div>
        ) : reportReadiness.latestSnapshot ? (
          <>
            <ReportSnapshotView
              payload={reportReadiness.latestSnapshot.payload}
              generatedAt={reportReadiness.latestSnapshot.generatedAt}
              reportVersion={reportReadiness.latestSnapshot.reportVersion}
            />

            {reportError ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {reportError}
              </div>
            ) : null}

            <div className="mt-6 border-t border-slate-200 pt-6">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => void handleDownloadPdf()}
                className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadingPdf ? "Preparing PDF..." : "Download governed PDF report"}
              </button>

              <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">
                The PDF is rendered from the immutable report-data snapshot and preserves the
                recorded scoring, normalization, interpretation, and report provenance.
              </p>
            </div>
          </>
        ) : !reportReadiness.canGenerate ? (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A report may be generated only when published norm data and a published interpretation
              set are available for this exact assessment version.
            </p>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Scientific configuration is incomplete. No interpretive report will be generated until
              the required published norm and interpretation data exists.
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Select the published scientific configuration that applies to this candidate. The
              backend validates the assessment version and refuses missing, ambiguous, unpublished,
              or incomplete scientific data.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Published norm group</span>

                <select
                  value={normGroupId}
                  onChange={(event) => setNormGroupId(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select norm group</option>

                  {reportReadiness.publishedNormGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.normSetName} — {group.name}
                      {group.sampleSize ? ` — n=${group.sampleSize}` : ""}
                    </option>
                  ))}
                </select>

                {normGroupId ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {
                      reportReadiness.publishedNormGroups.find((group) => group.id === normGroupId)
                        ?.sourceReference
                    }
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-800">
                  Published interpretation set
                </span>

                <select
                  value={interpretationSetId}
                  onChange={(event) => setInterpretationSetId(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select interpretation set</option>

                  {reportReadiness.publishedInterpretationSets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name} — {set.version}
                    </option>
                  ))}
                </select>

                {interpretationSetId ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {
                      reportReadiness.publishedInterpretationSets.find(
                        (set) => set.id === interpretationSetId,
                      )?.sourceReference
                    }
                  </p>
                ) : null}
              </label>
            </div>

            {reportError ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {reportError}
              </div>
            ) : null}

            <div className="mt-6">
              <button
                type="button"
                disabled={generatingReport || !normGroupId || !interpretationSetId}
                onClick={() => void handleGenerateReport()}
                className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingReport
                  ? "Generating governed report..."
                  : "Generate governed report data"}
              </button>

              <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-500">
                This action does not calculate new norms or invent interpretations. It applies only
                published configuration and stores an immutable report-data snapshot with
                provenance.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
