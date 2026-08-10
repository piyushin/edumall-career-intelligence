"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../../../lib/api";
import {
  createAssessmentDefinition,
  listAssessmentDefinitions,
  type AssessmentDefinitionSummary,
  type AssessmentVersionStatus,
} from "../../../lib/assessments";

function statusClass(status: AssessmentVersionStatus) {
  if (status === "PUBLISHED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  }

  if (status === "RETIRED") {
    return "bg-slate-100 text-slate-600 ring-slate-500/20";
  }

  return "bg-amber-50 text-amber-700 ring-amber-600/20";
}

export default function AssessmentsPage() {
  const [definitions, setDefinitions] = useState<AssessmentDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      setDefinitions(await listAssessmentDefinitions());
    } catch (caught) {
      setLoadError(caught instanceof ApiError ? caught.message : "Unable to load assessments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim();

    if (!normalizedCode) {
      setCreateError("Assessment code is required.");
      return;
    }

    setCreateError("");
    setCreating(true);

    try {
      await createAssessmentDefinition({ code: normalizedCode });
      setCode("");
      await load();
    } catch (caught) {
      setCreateError(caught instanceof ApiError ? caught.message : "Unable to create assessment.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">Assessment management</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Assessment library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Manage assessment definitions and inspect their immutable version lifecycle.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Create assessment definition</h2>
        <p className="mt-1 text-sm text-slate-600">
          This creates the assessment identity only. Version content and scoring are managed
          separately.
        </p>

        <form
          onSubmit={handleCreate}
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <div className="flex-1">
            <label htmlFor="assessment-code" className="sr-only">
              Assessment code
            </label>
            <input
              id="assessment-code"
              value={code}
              maxLength={120}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. CAREER-APTITUDE"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            {createError ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {createError}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create assessment"}
          </Button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Existing assessments</h2>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            Loading assessments...
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-medium text-red-900">Unable to load assessments</p>
            <p className="mt-1 text-sm text-red-700">{loadError}</p>
          </div>
        ) : definitions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h3 className="font-semibold text-slate-900">No assessments yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Create the first assessment definition above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {definitions.map((definition) => {
              const latest = definition.versions[0];

              return (
                <article
                  key={definition.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-950">{definition.code}</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {definition.status}
                        </span>
                        {definition.organizationId === null ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            Platform
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {definition.versions.length} version
                        {definition.versions.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    {latest ? (
                      <div className="text-left md:text-right">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(
                            latest.status,
                          )}`}
                        >
                          {latest.status}
                        </span>
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          v{latest.versionNumber} · {latest.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {latest.edition} · {latest.form} · {latest.language}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No versions created yet</p>
                    )}
                  </div>

                  {definition.versions.length > 0 ? (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="py-3 pr-4 font-medium">Version</th>
                            <th className="py-3 pr-4 font-medium">Title</th>
                            <th className="py-3 pr-4 font-medium">Status</th>
                            <th className="py-3 pr-4 font-medium">Scoring</th>
                            <th className="py-3 pr-4 font-medium">Norm</th>
                            <th className="py-3 font-medium">Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {definition.versions.map((version) => (
                            <tr
                              key={version.id}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <td className="py-3 pr-4 font-medium text-slate-900">
                                {version.versionNumber}
                              </td>
                              <td className="py-3 pr-4 text-slate-700">{version.title}</td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusClass(
                                    version.status,
                                  )}`}
                                >
                                  {version.status}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-slate-600">{version.scoringVersion}</td>
                              <td className="py-3 pr-4 text-slate-600">{version.normVersion}</td>
                              <td className="py-3 text-slate-600">{version.reportVersion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
