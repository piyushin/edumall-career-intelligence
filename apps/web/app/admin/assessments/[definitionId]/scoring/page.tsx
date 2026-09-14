"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../../../../../lib/api";
import {
  getAssessmentDefinition,
  listAssessmentConstructs,
  type AssessmentConstruct,
  type AssessmentDefinitionSummary,
} from "../../../../../lib/assessments";
import {
  createConstructNormTable,
  createNormGroup,
  createNormLookupRow,
  createNormSet,
  getNormSet,
  getNormSetPublicationReadiness,
  listNormSets,
  publishNormSet,
  retireNormSet,
  type NormPublicationReadiness,
  type NormSetDetail,
  type NormSetSummary,
} from "../../../../../lib/norm-admin";
import {
  createInterpretationRule,
  createInterpretationSet,
  getInterpretationSet,
  getInterpretationSetPublicationReadiness,
  listInterpretationSets,
  publishInterpretationSet,
  retireInterpretationSet,
  type InterpretationMetric,
  type InterpretationPublicationReadiness,
  type InterpretationRule,
  type InterpretationSetDetail,
  type InterpretationSetSummary,
} from "../../../../../lib/interpretation-admin";

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof ApiError ? caught.message : fallback;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {hint ? <span className="ml-2 text-xs text-slate-500">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PUBLISHED: "bg-green-50 text-green-800 border-green-200",
  RETIRED: "bg-slate-100 text-slate-500 border-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

function ReadinessPanel({
  disabled,
  ready,
  issues,
  onCheck,
  onPublish,
  publishLabel,
}: {
  disabled: boolean;
  ready: boolean | null;
  issues: Array<{ code: string; message: string }>;
  onCheck: () => Promise<void>;
  onPublish: () => Promise<void>;
  publishLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Publication readiness</p>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void onCheck()}
        >
          Check readiness
        </Button>
      </div>

      {ready === true ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">Ready to publish</p>
          <div className="mt-3">
            <Button type="button" disabled={disabled} onClick={() => void onPublish()}>
              {publishLabel}
            </Button>
          </div>
        </div>
      ) : ready === false ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Not ready</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span className="font-semibold">{issue.code}:</span> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function AssessmentScoringContentPage() {
  const params = useParams<{ definitionId: string }>();
  const definitionId = params.definitionId;

  const [definition, setDefinition] = useState<AssessmentDefinitionSummary | null>(null);
  const [constructs, setConstructs] = useState<AssessmentConstruct[]>([]);
  const [versionId, setVersionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDefinition = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getAssessmentDefinition(definitionId);
      setDefinition(result);

      if (!versionId && result.versions.length > 0) {
        const first = result.versions[0];
        if (first) setVersionId(first.id);
      }
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load assessment."));
    } finally {
      setLoading(false);
    }
  }, [definitionId]);

  useEffect(() => {
    void loadDefinition();
  }, [loadDefinition]);

  useEffect(() => {
    if (!versionId) {
      setConstructs([]);
      return;
    }

    let active = true;

    listAssessmentConstructs(definitionId, versionId)
      .then((result) => {
        if (active) setConstructs(result);
      })
      .catch(() => {
        if (active) setConstructs([]);
      });

    return () => {
      active = false;
    };
  }, [definitionId, versionId]);

  const selectedVersion = useMemo(
    () => definition?.versions.find((version) => version.id === versionId) ?? null,
    [definition, versionId],
  );

  if (loading) {
    return <p className="text-sm text-slate-600">Loading assessment workspace...</p>;
  }

  if (error || !definition) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-900">Unable to open assessment</p>
        <p className="mt-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          href={`/admin/assessments/${definitionId}`}
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← Back to {definition.code}
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-700">Scoring content</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Norms &amp; interpretation
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Norm tables and interpretation rules are authored per assessment version and are
              independent of the version&apos;s own DRAFT/PUBLISHED status. This authoring UI
              validates software/configuration integrity only -- it does not establish psychometric
              validity or approve norms or interpretations.
            </p>
          </div>

          <div className="min-w-64">
            <label className="text-sm font-medium text-slate-800">Assessment version</label>
            <select
              className={`${inputClass} mt-2`}
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
            >
              <option value="">Select a version</option>
              {definition.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber} — {version.title} ({version.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {!versionId || !selectedVersion ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-900">Select a version</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create at least one draft version on the assessment workspace page first.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          <NormSetsSection
            definitionId={definitionId}
            versionId={versionId}
            expectedNormVersion={selectedVersion.normVersion}
            constructs={constructs}
          />
          <InterpretationSetsSection
            definitionId={definitionId}
            versionId={versionId}
            constructs={constructs}
          />
        </div>
      )}
    </div>
  );
}

function NormSetsSection({
  definitionId,
  versionId,
  expectedNormVersion,
  constructs,
}: {
  definitionId: string;
  versionId: string;
  expectedNormVersion: string;
  constructs: AssessmentConstruct[];
}) {
  const [normSets, setNormSets] = useState<NormSetSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<NormSetDetail | null>(null);
  const [readiness, setReadiness] = useState<NormPublicationReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listNormSets(definitionId, versionId);
      setNormSets(result);

      if (result.length > 0 && !result.some((set) => set.id === selectedId)) {
        setSelectedId(result[0]?.id ?? "");
      } else if (result.length === 0) {
        setSelectedId("");
      }
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load norm sets."));
    } finally {
      setLoading(false);
    }
    // selectedId is read only to decide whether the current selection survived this
    // reload; omitting it would leave this callback closed over a stale selectedId,
    // wrongly resetting the admin's selection back to the first norm set after every
    // create/publish/retire action once there is more than one norm set.
  }, [definitionId, versionId, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    setReadiness(null);

    try {
      setDetail(await getNormSet(definitionId, versionId, selectedId));
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load this norm set."));
    }
  }, [definitionId, versionId, selectedId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");

    try {
      await action();
      await load();
      await loadDetail();
    } catch (caught) {
      setError(errorMessage(caught, "The action could not be completed."));
    } finally {
      setBusy(false);
    }
  }

  const group = detail?.groups[0] ?? null;
  const tablesByConstruct = new Map(
    (group?.constructTables ?? []).map((table) => [table.assessmentConstructId, table]),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Norm sets</h2>
        <p className="mt-1 text-sm text-slate-600">
          V1 supports exactly one norm group per norm set. A norm set&apos;s{" "}
          <span className="font-mono">normVersion</span> must equal this version&apos;s norm version
          identifier (<span className="font-mono">{expectedNormVersion}</span>) to ever be picked up
          by report generation.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <CreateNormSetForm
        disabled={busy}
        defaultNormVersion={expectedNormVersion}
        onCreate={(input) =>
          runAction(async () => {
            const created = await createNormSet(definitionId, versionId, input);
            setSelectedId(created.id);
          })
        }
      />

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : normSets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No norm sets yet for this version.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            className={inputClass}
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {normSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.normVersion} — {set.name} ({set.status})
              </option>
            ))}
          </select>

          {detail ? (
            <div className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{detail.name}</p>
                <StatusBadge status={detail.status} />
              </div>

              {detail.status === "DRAFT" && !group ? (
                <CreateNormGroupForm
                  disabled={busy}
                  onCreate={(input) =>
                    runAction(async () => {
                      await createNormGroup(definitionId, versionId, detail.id, input);
                    })
                  }
                />
              ) : null}

              {group ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Group: {group.code} — {group.name}
                  </p>

                  {constructs.map((construct) => {
                    const table = tablesByConstruct.get(construct.id);

                    return (
                      <div key={construct.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-sm font-medium text-slate-900">
                          {construct.code} — {construct.name}
                        </p>

                        {!table ? (
                          detail.status === "DRAFT" ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="mt-2"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  await createConstructNormTable(
                                    definitionId,
                                    versionId,
                                    detail.id,
                                    group.id,
                                    { assessmentConstructId: construct.id },
                                  );
                                })
                              }
                            >
                              Add norm table
                            </Button>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">No norm table.</p>
                          )
                        ) : (
                          <div className="mt-2 space-y-2">
                            {table.rows.length === 0 ? (
                              <p className="text-xs text-slate-500">No lookup rows yet.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-slate-500">
                                    <th className="pr-2">Raw min</th>
                                    <th className="pr-2">Raw max</th>
                                    <th className="pr-2">Standardized</th>
                                    <th>Percentile</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {table.rows.map((row) => (
                                    <tr key={row.id} className="text-slate-700">
                                      <td className="pr-2">{String(row.rawScoreMin)}</td>
                                      <td className="pr-2">{String(row.rawScoreMax)}</td>
                                      <td className="pr-2">{row.standardizedScore ?? "—"}</td>
                                      <td>{row.percentile ?? "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {detail.status === "DRAFT" ? (
                              <AddNormRowForm
                                disabled={busy}
                                onAdd={(input) =>
                                  runAction(async () => {
                                    await createNormLookupRow(
                                      definitionId,
                                      versionId,
                                      detail.id,
                                      group.id,
                                      table.id,
                                      input,
                                    );
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {detail.status === "DRAFT" ? (
                <ReadinessPanel
                  disabled={busy}
                  ready={readiness?.ready ?? null}
                  issues={readiness?.issues ?? []}
                  publishLabel="Publish norm set"
                  onCheck={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      setReadiness(
                        await getNormSetPublicationReadiness(definitionId, versionId, detail.id),
                      );
                    } catch (caught) {
                      setError(errorMessage(caught, "Unable to check readiness."));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onPublish={() =>
                    runAction(async () => {
                      await publishNormSet(definitionId, versionId, detail.id);
                    })
                  }
                />
              ) : detail.status === "PUBLISHED" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void runAction(async () => {
                      await retireNormSet(definitionId, versionId, detail.id);
                    })
                  }
                >
                  Retire norm set
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CreateNormSetForm({
  disabled,
  defaultNormVersion,
  onCreate,
}: {
  disabled: boolean;
  defaultNormVersion: string;
  onCreate: (input: { normVersion: string; name: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [normVersion, setNormVersion] = useState(defaultNormVersion);
  const [name, setName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normVersion.trim() || !name.trim()) return;

    await onCreate({ normVersion: normVersion.trim(), name: name.trim() });
    setName("");
    setOpen(false);
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "New norm set"}
      </Button>

      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <Field label="Norm version" hint="must match the assessment version's norm version">
            <input
              className={inputClass}
              value={normVersion}
              onChange={(event) => setNormVersion(event.target.value)}
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={disabled || !normVersion.trim() || !name.trim()}>
            Create norm set
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function CreateNormGroupForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (input: { code: string; name: string }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return;
    await onCreate({ code: code.trim(), name: name.trim() });
    setCode("");
    setName("");
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-600">
        This norm set has no group yet. Create the single group V1 supports.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Group code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Group name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={disabled || !code.trim() || !name.trim()}>
        Add group
      </Button>
    </form>
  );
}

function AddNormRowForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (input: {
    rawScoreMin: number;
    rawScoreMax: number;
    standardizedScore?: number;
    percentile?: number;
  }) => Promise<void>;
}) {
  const [rawScoreMin, setRawScoreMin] = useState("");
  const [rawScoreMax, setRawScoreMax] = useState("");
  const [standardizedScore, setStandardizedScore] = useState("");
  const [percentile, setPercentile] = useState("");

  const valid =
    rawScoreMin !== "" &&
    rawScoreMax !== "" &&
    Number.isFinite(Number(rawScoreMin)) &&
    Number.isFinite(Number(rawScoreMax));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;

    await onAdd({
      rawScoreMin: Number(rawScoreMin),
      rawScoreMax: Number(rawScoreMax),
      ...(standardizedScore !== "" ? { standardizedScore: Number(standardizedScore) } : {}),
      ...(percentile !== "" ? { percentile: Number(percentile) } : {}),
    });

    setRawScoreMin("");
    setRawScoreMax("");
    setStandardizedScore("");
    setPercentile("");
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <input
        className={inputClass}
        type="number"
        step="any"
        placeholder="Raw min"
        value={rawScoreMin}
        onChange={(event) => setRawScoreMin(event.target.value)}
      />
      <input
        className={inputClass}
        type="number"
        step="any"
        placeholder="Raw max"
        value={rawScoreMax}
        onChange={(event) => setRawScoreMax(event.target.value)}
      />
      <input
        className={inputClass}
        type="number"
        step="any"
        placeholder="Standardized (opt.)"
        value={standardizedScore}
        onChange={(event) => setStandardizedScore(event.target.value)}
      />
      <input
        className={inputClass}
        type="number"
        step="any"
        placeholder="Percentile (opt.)"
        value={percentile}
        onChange={(event) => setPercentile(event.target.value)}
      />
      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={disabled || !valid}>
          Add lookup row
        </Button>
      </div>
    </form>
  );
}

function InterpretationSetsSection({
  definitionId,
  versionId,
  constructs,
}: {
  definitionId: string;
  versionId: string;
  constructs: AssessmentConstruct[];
}) {
  const [sets, setSets] = useState<InterpretationSetSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<InterpretationSetDetail | null>(null);
  const [readiness, setReadiness] = useState<InterpretationPublicationReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await listInterpretationSets(definitionId, versionId);
      setSets(result);

      if (result.length > 0 && !result.some((set) => set.id === selectedId)) {
        setSelectedId(result[0]?.id ?? "");
      } else if (result.length === 0) {
        setSelectedId("");
      }
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load interpretation sets."));
    } finally {
      setLoading(false);
    }
    // See the matching comment in NormSetsSection.load: selectedId must be a dependency
    // or this callback stays closed over a stale value and silently resets the admin's
    // selection to the first interpretation set after every action.
  }, [definitionId, versionId, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    setReadiness(null);

    try {
      setDetail(await getInterpretationSet(definitionId, versionId, selectedId));
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load this interpretation set."));
    }
  }, [definitionId, versionId, selectedId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");

    try {
      await action();
      await load();
      await loadDetail();
    } catch (caught) {
      setError(errorMessage(caught, "The action could not be completed."));
    } finally {
      setBusy(false);
    }
  }

  const rulesByConstruct = new Map<string, InterpretationRule[]>();
  for (const rule of detail?.rules ?? []) {
    const list = rulesByConstruct.get(rule.assessmentConstructId) ?? [];
    list.push(rule);
    rulesByConstruct.set(rule.assessmentConstructId, list);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Interpretation sets</h2>
        <p className="mt-1 text-sm text-slate-600">
          Only one interpretation set may be published per assessment version. Rules with the same
          construct, metric and priority must not have overlapping ranges -- a higher-priority rule
          is free to overlap a lower one; it always wins.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <CreateInterpretationSetForm
        disabled={busy}
        onCreate={(input) =>
          runAction(async () => {
            const created = await createInterpretationSet(definitionId, versionId, input);
            setSelectedId(created.id);
          })
        }
      />

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : sets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No interpretation sets yet for this version.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            className={inputClass}
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.version} — {set.name} ({set.status})
              </option>
            ))}
          </select>

          {detail ? (
            <div className="space-y-4 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{detail.name}</p>
                <StatusBadge status={detail.status} />
              </div>

              <div className="space-y-3">
                {constructs.map((construct) => {
                  const rules = rulesByConstruct.get(construct.id) ?? [];

                  return (
                    <div key={construct.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-900">
                        {construct.code} — {construct.name}
                      </p>

                      {rules.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-500">No interpretation rules yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-xs text-slate-700">
                          {rules.map((rule) => (
                            <li key={rule.id}>
                              <span className="font-mono">{rule.code}</span> · {rule.metric} ·{" ["}
                              {rule.lowerBound ?? "-∞"}
                              {rule.lowerInclusive ? "]" : ")"} to {rule.upperInclusive ? "[" : "("}
                              {rule.upperBound ?? "+∞"}
                              {"]"} · priority {rule.priority}
                            </li>
                          ))}
                        </ul>
                      )}

                      {detail.status === "DRAFT" ? (
                        <AddInterpretationRuleForm
                          disabled={busy}
                          onAdd={(input) =>
                            runAction(async () => {
                              await createInterpretationRule(definitionId, versionId, detail.id, {
                                ...input,
                                assessmentConstructId: construct.id,
                              });
                            })
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {detail.status === "DRAFT" ? (
                <ReadinessPanel
                  disabled={busy}
                  ready={readiness?.ready ?? null}
                  issues={readiness?.issues ?? []}
                  publishLabel="Publish interpretation set"
                  onCheck={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      setReadiness(
                        await getInterpretationSetPublicationReadiness(
                          definitionId,
                          versionId,
                          detail.id,
                        ),
                      );
                    } catch (caught) {
                      setError(errorMessage(caught, "Unable to check readiness."));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onPublish={() =>
                    runAction(async () => {
                      await publishInterpretationSet(definitionId, versionId, detail.id);
                    })
                  }
                />
              ) : detail.status === "PUBLISHED" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void runAction(async () => {
                      await retireInterpretationSet(definitionId, versionId, detail.id);
                    })
                  }
                >
                  Retire interpretation set
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function CreateInterpretationSetForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (input: { version: string; name: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("v1");
  const [name, setName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version.trim() || !name.trim()) return;

    await onCreate({ version: version.trim(), name: name.trim() });
    setName("");
    setOpen(false);
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "New interpretation set"}
      </Button>

      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <Field label="Version">
            <input
              className={inputClass}
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={disabled || !version.trim() || !name.trim()}>
            Create interpretation set
          </Button>
        </form>
      ) : null}
    </div>
  );
}

const metricOptions: InterpretationMetric[] = ["STANDARDIZED_SCORE", "PERCENTILE", "RAW_SCORE"];

function AddInterpretationRuleForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (input: {
    code: string;
    metric: InterpretationMetric;
    lowerBound?: number;
    upperBound?: number;
    priority?: number;
    outputData?: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [metric, setMetric] = useState<InterpretationMetric>("STANDARDIZED_SCORE");
  const [lowerBound, setLowerBound] = useState("");
  const [upperBound, setUpperBound] = useState("");
  const [priority, setPriority] = useState("0");
  const [outputDataText, setOutputDataText] = useState('{\n  "band": ""\n}');
  const [jsonError, setJsonError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJsonError("");

    if (!code.trim()) return;

    let outputData: Record<string, unknown> | undefined;

    if (outputDataText.trim()) {
      try {
        const parsed: unknown = JSON.parse(outputDataText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setJsonError("Output data must be a JSON object.");
          return;
        }
        outputData = parsed as Record<string, unknown>;
      } catch {
        setJsonError("Output data is not valid JSON.");
        return;
      }
    }

    await onAdd({
      code: code.trim(),
      metric,
      ...(lowerBound !== "" ? { lowerBound: Number(lowerBound) } : {}),
      ...(upperBound !== "" ? { upperBound: Number(upperBound) } : {}),
      ...(priority !== "" ? { priority: Number(priority) } : {}),
      ...(outputData ? { outputData } : {}),
    });

    setCode("");
    setLowerBound("");
    setUpperBound("");
    setOpen(false);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "+ Add rule"}
      </button>

      {open ? (
        <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={inputClass}
              placeholder="Rule code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <select
              className={inputClass}
              value={metric}
              onChange={(event) => setMetric(event.target.value as InterpretationMetric)}
            >
              {metricOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className={inputClass}
              type="number"
              step="any"
              placeholder="Lower bound (opt.)"
              value={lowerBound}
              onChange={(event) => setLowerBound(event.target.value)}
            />
            <input
              className={inputClass}
              type="number"
              step="any"
              placeholder="Upper bound (opt.)"
              value={upperBound}
              onChange={(event) => setUpperBound(event.target.value)}
            />
            <input
              className={inputClass}
              type="number"
              step="1"
              placeholder="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>

          <Field label="Output data (JSON)" hint='e.g. { "band": "Strong" }'>
            <textarea
              className={`${inputClass} font-mono`}
              rows={3}
              value={outputDataText}
              onChange={(event) => setOutputDataText(event.target.value)}
            />
          </Field>

          {jsonError ? <p className="text-xs text-red-700">{jsonError}</p> : null}

          <Button type="submit" disabled={disabled || !code.trim()}>
            Add rule
          </Button>
        </form>
      ) : null}
    </div>
  );
}
