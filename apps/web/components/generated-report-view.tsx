import type { AssessmentReportPayload } from "../lib/assessment-results";
import { formatDate, Panel } from "./admin-ui";

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Narrative({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <p className="text-sm text-slate-500">No published narrative is available.</p>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(value)}</p>;
  if (Array.isArray(value))
    return (
      <ul className="space-y-2 pl-5 text-sm text-slate-700">
        {value.map((item, index) => (
          <li key={index} className="list-disc">
            <Narrative value={item} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-3">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label(key)}
            </dt>
            <dd className="mt-1">
              <Narrative value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return null;
}

export function GeneratedReportView({
  payload,
  generatedAt,
  reportVersion,
}: {
  payload: AssessmentReportPayload;
  generatedAt: string;
  reportVersion: string;
}) {
  const normByConstruct = new Map(payload.norms.map((item) => [item.assessmentConstructId, item]));
  const interpretationByConstruct = new Map(
    payload.interpretation.applications.map((item) => [item.assessmentConstructId, item]),
  );
  return (
    <div className="space-y-5">
      <Panel>
        <h2 className="text-xl font-semibold text-slate-950">Report overview</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This immutable report was generated {formatDate(generatedAt)} using report version{" "}
          {reportVersion}. It contains {payload.scoring.constructs.length} interpreted dimensions
          and {payload.careerFit?.rankedCareerPaths.length ?? 0} career directions.
        </p>
      </Panel>

      {payload.careerFit?.rankedCareerPaths.length ? (
        <Panel>
          <h2 className="text-xl font-semibold text-slate-950">CareerFit directions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {payload.careerFit.rankedCareerPaths.map((path) => (
              <article key={path.careerPathId} className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  Rank {path.rank}
                </p>
                <p className="mt-1 font-medium text-slate-900">Career direction</p>
                <p className="mt-2 text-sm text-slate-600">Governed fit score: {path.score}</p>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="text-xl font-semibold text-slate-950">Interpreted profile</h2>
        <div className="mt-4 space-y-4">
          {payload.scoring.constructs.map((construct) => {
            const norm = normByConstruct.get(construct.assessmentConstructId);
            const interpretation = interpretationByConstruct.get(construct.assessmentConstructId);
            return (
              <article
                key={construct.assessmentConstructId}
                className="rounded-xl border border-slate-200 p-5"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="font-semibold text-slate-950">{construct.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{construct.code}</p>
                  </div>
                  <dl className="flex gap-5 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Standardized</dt>
                      <dd className="font-semibold">{norm?.standardizedScore ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Percentile</dt>
                      <dd className="font-semibold">{norm?.percentile ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 p-4">
                  <Narrative value={interpretation?.outputData} />
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
