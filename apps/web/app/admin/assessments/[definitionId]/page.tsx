"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../../../../lib/api";
import {
  createAssessmentConstruct,
  createAssessmentItem,
  createAssessmentItemConstructLink,
  createAssessmentItemOption,
  createAssessmentOptionScore,
  createAssessmentVersion,
  getAssessmentDefinition,
  getAssessmentVersionContent,
  getPublicationReadiness,
  publishAssessmentVersion,
  type AssessmentDefinitionSummary,
  type AssessmentItem,
  type AssessmentItemType,
  type AssessmentVersionContent,
  type PublicationReadiness,
} from "../../../../lib/assessments";

const scoredTypes = new Set<AssessmentItemType>(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "LIKERT"]);

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof ApiError ? caught.message : fallback;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export default function AssessmentWorkspacePage() {
  const params = useParams<{ definitionId: string }>();
  const definitionId = params.definitionId;

  const [definition, setDefinition] = useState<AssessmentDefinitionSummary | null>(null);
  const [content, setContent] = useState<AssessmentVersionContent | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [readiness, setReadiness] = useState<PublicationReadiness | null>(null);

  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const draftVersions = useMemo(
    () => definition?.versions.filter((version) => version.status === "DRAFT") ?? [],
    [definition],
  );

  const loadDefinition = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getAssessmentDefinition(definitionId);
      setDefinition(result);

      const currentDraft =
        result.versions.find((version) => version.id === selectedVersionId) ??
        result.versions.find((version) => version.status === "DRAFT");

      if (currentDraft?.status === "DRAFT") {
        setSelectedVersionId(currentDraft.id);
      } else {
        setSelectedVersionId("");
        setContent(null);
      }
    } catch (caught) {
      setError(errorMessage(caught, "Unable to load assessment."));
    } finally {
      setLoading(false);
    }
  }, [definitionId, selectedVersionId]);

  const loadContent = useCallback(async () => {
    if (!selectedVersionId) {
      setContent(null);
      return;
    }

    setContentLoading(true);
    setActionError("");
    setReadiness(null);

    try {
      setContent(await getAssessmentVersionContent(definitionId, selectedVersionId));
    } catch (caught) {
      setActionError(errorMessage(caught, "Unable to load draft assessment content."));
    } finally {
      setContentLoading(false);
    }
  }, [definitionId, selectedVersionId]);

  useEffect(() => {
    void loadDefinition();
  }, [loadDefinition]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  async function refreshAll() {
    await loadDefinition();
    await loadContent();
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setActionError("");
    setReadiness(null);

    try {
      await action();
      await refreshAll();
    } catch (caught) {
      setActionError(errorMessage(caught, "The action could not be completed."));
    } finally {
      setBusy(false);
    }
  }

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
          href="/admin/assessments"
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          ← Assessment library
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-700">Assessment authoring workspace</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {definition.code}
            </h1>
            <p className="mt-2 text-sm text-slate-600">Definition status: {definition.status}</p>
          </div>

          <div className="min-w-64">
            <label className="text-sm font-medium text-slate-800">Active draft</label>
            <select
              className={`${inputClass} mt-2`}
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
            >
              <option value="">Select a draft version</option>
              {draftVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.versionNumber} — {version.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {actionError}
        </div>
      ) : null}

      <CreateVersionPanel
        definitionId={definitionId}
        nextVersionNumber={
          Math.max(0, ...definition.versions.map((version) => version.versionNumber)) + 1
        }
        disabled={busy}
        onCreated={async (versionId) => {
          await loadDefinition();
          setSelectedVersionId(versionId);
        }}
      />

      {!selectedVersionId ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-900">Create or select a draft version</h2>
          <p className="mt-2 text-sm text-slate-600">
            Assessment content is authored inside a DRAFT version.
          </p>
        </div>
      ) : contentLoading ? (
        <p className="text-sm text-slate-600">Loading draft content...</p>
      ) : content ? (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <ConstructPanel
              content={content}
              disabled={busy}
              onCreate={(input) =>
                runAction(async () => {
                  await createAssessmentConstruct(definitionId, selectedVersionId, input);
                })
              }
            />

            <ItemPanel
              content={content}
              disabled={busy}
              onCreate={(input) =>
                runAction(async () => {
                  await createAssessmentItem(definitionId, selectedVersionId, input);
                })
              }
            />
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Questions & scoring</h2>
              <p className="mt-1 text-sm text-slate-600">
                Configure options, construct links and explicit scores. No score is inferred
                automatically.
              </p>
            </div>

            {content.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">
                No questions have been added yet.
              </div>
            ) : (
              content.items.map((item) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  content={content}
                  disabled={busy}
                  onAddOption={(input) =>
                    runAction(async () => {
                      await createAssessmentItemOption(
                        definitionId,
                        selectedVersionId,
                        item.id,
                        input,
                      );
                    })
                  }
                  onLinkConstruct={(input) =>
                    runAction(async () => {
                      await createAssessmentItemConstructLink(
                        definitionId,
                        selectedVersionId,
                        item.id,
                        input,
                      );
                    })
                  }
                  onAddScore={(optionId, input) =>
                    runAction(async () => {
                      await createAssessmentOptionScore(
                        definitionId,
                        selectedVersionId,
                        item.id,
                        optionId,
                        input,
                      );
                    })
                  }
                />
              ))
            )}
          </section>

          <PublicationPanel
            disabled={busy}
            readiness={readiness}
            onCheck={async () => {
              setBusy(true);
              setActionError("");

              try {
                setReadiness(await getPublicationReadiness(definitionId, selectedVersionId));
              } catch (caught) {
                setActionError(errorMessage(caught, "Unable to check publication readiness."));
              } finally {
                setBusy(false);
              }
            }}
            onPublish={async () => {
              await runAction(async () => {
                await publishAssessmentVersion(definitionId, selectedVersionId);
                setSelectedVersionId("");
                setContent(null);
              });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function CreateVersionPanel({
  definitionId,
  nextVersionNumber,
  disabled,
  onCreated,
}: {
  definitionId: string;
  nextVersionNumber: number;
  disabled: boolean;
  onCreated: (versionId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    edition: "1",
    form: "A",
    language: "en",
    scoringVersion: "1",
    normVersion: "1",
    reportVersion: "1",
    description: "",
    instructions: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const required = [
      form.title,
      form.edition,
      form.form,
      form.language,
      form.scoringVersion,
      form.normVersion,
      form.reportVersion,
    ];

    if (required.some((value) => !value.trim())) {
      setError("All required version fields must contain a value.");
      return;
    }

    setSubmitting(true);

    try {
      const version = await createAssessmentVersion(definitionId, {
        versionNumber: nextVersionNumber,
        title: form.title.trim(),
        edition: form.edition.trim(),
        form: form.form.trim(),
        language: form.language.trim(),
        scoringVersion: form.scoringVersion.trim(),
        normVersion: form.normVersion.trim(),
        reportVersion: form.reportVersion.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.instructions.trim() ? { instructions: form.instructions.trim() } : {}),
      });

      setOpen(false);
      setForm((current) => ({ ...current, title: "", description: "", instructions: "" }));
      await onCreated(version.id);
    } catch (caught) {
      setError(errorMessage(caught, "Unable to create draft version."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Version management</h2>
          <p className="mt-1 text-sm text-slate-600">
            Next suggested version number: {nextVersionNumber}
          </p>
        </div>
        <Button
          type="button"
          variant={open ? "secondary" : "primary"}
          onClick={() => setOpen((value) => !value)}
          disabled={disabled}
        >
          {open ? "Close" : "Create draft version"}
        </Button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <input
              className={inputClass}
              maxLength={200}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </Field>

          <Field label="Edition">
            <input
              className={inputClass}
              maxLength={60}
              value={form.edition}
              onChange={(event) => setForm({ ...form, edition: event.target.value })}
              required
            />
          </Field>

          <Field label="Form">
            <input
              className={inputClass}
              maxLength={60}
              value={form.form}
              onChange={(event) => setForm({ ...form, form: event.target.value })}
              required
            />
          </Field>

          <Field label="Language">
            <input
              className={inputClass}
              maxLength={20}
              value={form.language}
              onChange={(event) => setForm({ ...form, language: event.target.value })}
              required
            />
          </Field>

          <Field label="Scoring version identifier">
            <input
              className={inputClass}
              maxLength={60}
              value={form.scoringVersion}
              onChange={(event) => setForm({ ...form, scoringVersion: event.target.value })}
              required
            />
          </Field>

          <Field label="Norm version identifier">
            <input
              className={inputClass}
              maxLength={60}
              value={form.normVersion}
              onChange={(event) => setForm({ ...form, normVersion: event.target.value })}
              required
            />
          </Field>

          <Field label="Report version identifier">
            <input
              className={inputClass}
              maxLength={60}
              value={form.reportVersion}
              onChange={(event) => setForm({ ...form, reportVersion: event.target.value })}
              required
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Candidate instructions">
              <textarea
                className={inputClass}
                rows={4}
                value={form.instructions}
                onChange={(event) => setForm({ ...form, instructions: event.target.value })}
              />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="md:col-span-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={disabled || submitting}>
              {submitting ? "Creating..." : `Create version ${nextVersionNumber}`}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ConstructPanel({
  content,
  disabled,
  onCreate,
}: {
  content: AssessmentVersionContent;
  disabled: boolean;
  onCreate: (input: { code: string; name: string; orderIndex: number }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!code.trim() || !name.trim()) {
      return;
    }

    await onCreate({
      code: code.trim(),
      name: name.trim(),
      orderIndex: content.constructs.length,
    });

    setCode("");
    setName("");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Constructs</h2>
      <p className="mt-1 text-sm text-slate-600">
        Constructs represent dimensions measured by the assessment.
      </p>

      <div className="mt-4 space-y-2">
        {content.constructs.map((construct) => (
          <div key={construct.id} className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">
              {construct.code} — {construct.name}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <Field label="Construct code">
          <input
            className={inputClass}
            value={code}
            maxLength={120}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <Field label="Construct name">
          <input
            className={inputClass}
            value={name}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={disabled || !code.trim() || !name.trim()}>
          Add construct
        </Button>
      </form>
    </section>
  );
}

function ItemPanel({
  content,
  disabled,
  onCreate,
}: {
  content: AssessmentVersionContent;
  disabled: boolean;
  onCreate: (input: {
    code: string;
    type: AssessmentItemType;
    prompt: string;
    orderIndex: number;
    required: boolean;
  }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<AssessmentItemType>("SINGLE_CHOICE");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!code.trim() || !prompt.trim()) {
      return;
    }

    await onCreate({
      code: code.trim(),
      type,
      prompt: prompt.trim(),
      orderIndex: content.items.length,
      required: true,
    });

    setCode("");
    setPrompt("");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Add question</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choice and Likert items can use explicit option scoring.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <Field label="Question code">
          <input
            className={inputClass}
            value={code}
            maxLength={120}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>

        <Field label="Response type">
          <select
            className={inputClass}
            value={type}
            onChange={(event) => setType(event.target.value as AssessmentItemType)}
          >
            <option value="SINGLE_CHOICE">Single choice</option>
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="LIKERT">Likert</option>
            <option value="BOOLEAN">Boolean</option>
            <option value="NUMERIC">Numeric</option>
            <option value="TEXT">Text</option>
          </select>
        </Field>

        <Field label="Question prompt">
          <textarea
            className={inputClass}
            rows={4}
            value={prompt}
            maxLength={10000}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </Field>

        <Button type="submit" disabled={disabled || !code.trim() || !prompt.trim()}>
          Add question
        </Button>
      </form>
    </section>
  );
}

function ItemEditor({
  item,
  content,
  disabled,
  onAddOption,
  onLinkConstruct,
  onAddScore,
}: {
  item: AssessmentItem;
  content: AssessmentVersionContent;
  disabled: boolean;
  onAddOption: (input: { code: string; label: string; orderIndex: number }) => Promise<void>;
  onLinkConstruct: (input: {
    constructId: string;
    weight: number;
    reverseScored: boolean;
  }) => Promise<void>;
  onAddScore: (optionId: string, input: { constructId: string; score: number }) => Promise<void>;
}) {
  const [optionCode, setOptionCode] = useState("");
  const [optionLabel, setOptionLabel] = useState("");
  const [constructId, setConstructId] = useState("");
  const [weight, setWeight] = useState("1");
  const [reverseScored, setReverseScored] = useState(false);

  const unlinkedConstructs = content.constructs.filter(
    (construct) => !item.constructLinks.some((link) => link.assessmentConstructId === construct.id),
  );

  const linkedConstructs = item.constructLinks
    .map((link) => ({
      ...link,
      construct: content.constructs.find(
        (construct) => construct.id === link.assessmentConstructId,
      ),
    }))
    .filter((entry) => entry.construct);

  async function addOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!optionCode.trim() || !optionLabel.trim()) {
      return;
    }

    await onAddOption({
      code: optionCode.trim(),
      label: optionLabel.trim(),
      orderIndex: item.options.length,
    });

    setOptionCode("");
    setOptionLabel("");
  }

  async function linkConstruct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!constructId) {
      return;
    }

    await onLinkConstruct({
      constructId,
      weight: Number(weight),
      reverseScored,
    });

    setConstructId("");
    setWeight("1");
    setReverseScored(false);
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {item.code}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {item.type.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-3 font-medium leading-6 text-slate-950">{item.prompt}</p>
        </div>
      </div>

      {scoredTypes.has(item.type) ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Answer options</h3>

            <div className="mt-3 space-y-3">
              {item.options.map((option) => (
                <div key={option.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    {option.code} — {option.label}
                  </p>

                  {linkedConstructs.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {linkedConstructs.map(({ construct }) => {
                        if (!construct) return null;

                        const score = option.scores.find(
                          (candidate) => candidate.assessmentConstructId === construct.id,
                        );

                        return (
                          <ScoreEditor
                            key={construct.id}
                            constructName={construct.name}
                            existingScore={score?.score}
                            disabled={disabled || score !== undefined}
                            onSave={(value) =>
                              onAddScore(option.id, {
                                constructId: construct.id,
                                score: value,
                              })
                            }
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Link this question to a construct before adding scores.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={addOption} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                value={optionCode}
                placeholder="Option code"
                onChange={(event) => setOptionCode(event.target.value)}
              />
              <input
                className={inputClass}
                value={optionLabel}
                placeholder="Option label"
                onChange={(event) => setOptionLabel(event.target.value)}
              />
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={disabled || !optionCode.trim() || !optionLabel.trim()}
                >
                  Add option
                </Button>
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Construct scoring links</h3>

            <div className="mt-3 space-y-2">
              {linkedConstructs.map(({ construct, weight, reverseScored }) =>
                construct ? (
                  <div
                    key={construct.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-900">{construct.name}</span>
                    <span className="ml-2 text-slate-500">
                      weight {String(weight)}
                      {reverseScored ? " · reverse flag" : ""}
                    </span>
                  </div>
                ) : null,
              )}
            </div>

            {unlinkedConstructs.length > 0 ? (
              <form onSubmit={linkConstruct} className="mt-4 space-y-3">
                <select
                  className={inputClass}
                  value={constructId}
                  onChange={(event) => setConstructId(event.target.value)}
                >
                  <option value="">Select construct</option>
                  {unlinkedConstructs.map((construct) => (
                    <option key={construct.id} value={construct.id}>
                      {construct.code} — {construct.name}
                    </option>
                  ))}
                </select>

                <input
                  className={inputClass}
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  aria-label="Construct weight"
                />

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={reverseScored}
                    onChange={(event) => setReverseScored(event.target.checked)}
                  />
                  Preserve reverse-scored metadata
                </label>

                <p className="text-xs leading-5 text-slate-500">
                  The scoring engine uses the explicit option scores entered above; it does not
                  infer values from the reverse flag.
                </p>

                <Button
                  type="submit"
                  disabled={disabled || !constructId || !Number.isFinite(Number(weight))}
                >
                  Link construct
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          This response type is currently treated as unscored by the explicit option-scoring engine.
          Do not attach construct scoring links unless a supported scoring strategy is added.
        </div>
      )}
    </article>
  );
}

function ScoreEditor({
  constructName,
  existingScore,
  disabled,
  onSave,
}: {
  constructName: string;
  existingScore: number | string | undefined;
  disabled: boolean;
  onSave: (score: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");

  if (existingScore !== undefined) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs">
        <span className="font-medium text-emerald-900">{constructName}</span>
        <span className="font-semibold text-emerald-700">Score {String(existingScore)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-28 text-xs text-slate-600">{constructName}</span>
      <input
        type="number"
        step="0.01"
        value={value}
        aria-label={`Score for ${constructName}`}
        onChange={(event) => setValue(event.target.value)}
        className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={disabled || value === "" || !Number.isFinite(Number(value))}
        onClick={() => void onSave(Number(value)).then(() => setValue(""))}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
      >
        Save score
      </button>
    </div>
  );
}

function PublicationPanel({
  disabled,
  readiness,
  onCheck,
  onPublish,
}: {
  disabled: boolean;
  readiness: PublicationReadiness | null;
  onCheck: () => Promise<void>;
  onPublish: () => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Publication readiness</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            These checks validate software/configuration integrity only. They do not establish
            psychometric validity or approve norms, interpretations or clinical claims.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void onCheck()}
        >
          Check readiness
        </Button>
      </div>

      {readiness ? (
        <div className="mt-5">
          {readiness.ready ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-900">Technical publication checks passed</p>
              <p className="mt-1 text-sm text-emerald-700">
                This draft can transition to PUBLISHED.
              </p>

              <div className="mt-4">
                <Button type="button" disabled={disabled} onClick={() => void onPublish()}>
                  Publish version
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">Publication blockers found</p>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                {readiness.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    <span className="font-semibold">{issue.code}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
