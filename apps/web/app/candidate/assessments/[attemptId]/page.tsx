"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../../lib/api";
import {
  getCandidateAttempt,
  saveCandidateResponse,
  submitCandidateAttempt,
  type CandidateAssessmentItem,
  type CandidateAssessmentResponse,
  type CandidateAttempt,
  type SaveCandidateResponse,
} from "../../../../lib/candidate-assessments";

function responseForItem(
  responses: CandidateAssessmentResponse[],
  itemId: string,
): CandidateAssessmentResponse | undefined {
  return responses.find((response) => response.itemId === itemId);
}

function isAnswered(
  item: CandidateAssessmentItem,
  response: CandidateAssessmentResponse | undefined,
): boolean {
  if (!response) {
    return false;
  }

  if (item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE" || item.type === "LIKERT") {
    return response.optionIds.length > 0;
  }

  if (item.type === "BOOLEAN") {
    return response.booleanValue !== null;
  }

  if (item.type === "NUMERIC") {
    return response.numericValue !== null;
  }

  return Boolean(response.textValue?.trim());
}

export default function CandidateAttemptPage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = params.attemptId;

  const [attempt, setAttempt] = useState<CandidateAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  async function loadAttempt() {
    setError("");

    try {
      const loaded = await getCandidateAttempt(attemptId);
      setAttempt(loaded);

      const firstUnanswered = loaded.assignment.assessmentVersion.items.findIndex(
        (item) => !isAnswered(item, responseForItem(loaded.responses, item.id)),
      );

      if (firstUnanswered >= 0) {
        setCurrentIndex(firstUnanswered);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load this assessment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttempt();
  }, [attemptId]);

  const items = attempt?.assignment.assessmentVersion.items ?? [];
  const currentItem = items[currentIndex];

  const answeredCount = useMemo(() => {
    if (!attempt) {
      return 0;
    }

    return items.filter((item) => isAnswered(item, responseForItem(attempt.responses, item.id)))
      .length;
  }, [attempt, items]);

  async function save(item: CandidateAssessmentItem, payload: SaveCandidateResponse) {
    if (!attempt || attempt.status !== "IN_PROGRESS") {
      return;
    }

    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      await saveCandidateResponse(attempt.id, item.id, payload);
      const refreshed = await getCandidateAttempt(attempt.id);
      setAttempt(refreshed);
      setSaveMessage("Saved");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to save your response.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!attempt) {
      return;
    }

    const requiredMissing = items.filter(
      (item) => item.required && !isAnswered(item, responseForItem(attempt.responses, item.id)),
    );

    if (requiredMissing.length > 0) {
      setError(
        `${requiredMissing.length} required question${
          requiredMissing.length === 1 ? " is" : "s are"
        } still unanswered.`,
      );
      const firstMissingIndex = items.findIndex((item) => item.id === requiredMissing[0]?.id);

      if (firstMissingIndex >= 0) {
        setCurrentIndex(firstMissingIndex);
      }

      return;
    }

    if (
      !window.confirm(
        "Submit this assessment? After submission, your responses can no longer be changed.",
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await submitCandidateAttempt(attempt.id);
      const refreshed = await getCandidateAttempt(attempt.id);
      setAttempt(refreshed);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to submit this assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Loading assessment...
        </div>
      </main>
    );
  }

  if (!attempt || !currentItem) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-white p-8">
          <h1 className="text-xl font-semibold text-slate-950">Assessment unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error || "This assessment could not be loaded."}
          </p>
          <Link
            href="/candidate/assessments"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Return to My Assessments
          </Link>
        </div>
      </main>
    );
  }

  const version = attempt.assignment.assessmentVersion;
  const response = responseForItem(attempt.responses, currentItem.id);
  const progress = items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0;

  if (attempt.status === "SUBMITTED") {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
            ✓
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-slate-950">Assessment submitted</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Your responses for <strong>{version.title}</strong> have been submitted successfully.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Scoring and report processing occur through the secured assessment pipeline. Candidate
            result presentation will only display approved report information when available.
          </p>
          <button
            type="button"
            onClick={() => router.push("/candidate/assessments")}
            className="mt-8 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Back to My Assessments
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6">
          <Link
            href="/candidate/assessments"
            className="text-sm font-medium text-blue-700 hover:text-blue-600"
          >
            ← My Assessments
          </Link>

          <h1 className="mt-5 text-lg font-semibold text-slate-950">{version.title}</h1>
          <p className="mt-1 text-xs text-slate-500">
            Attempt {attempt.attemptNumber} · {version.language}
          </p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>
                {answeredCount}/{items.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-5 gap-2 lg:grid-cols-4">
            {items.map((item, index) => {
              const answered = isAnswered(item, responseForItem(attempt.responses, item.id));
              const active = index === currentIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(index);
                    setError("");
                    setSaveMessage("");
                  }}
                  aria-label={`Question ${index + 1}`}
                  className={`aspect-square rounded-lg border text-xs font-semibold transition ${
                    active
                      ? "border-blue-700 bg-blue-700 text-white"
                      : answered
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-blue-700">
              Question {currentIndex + 1} of {items.length}
            </p>
            <div className="text-xs text-slate-500">{saving ? "Saving..." : saveMessage}</div>
          </div>

          <h2 className="mt-5 text-xl font-semibold leading-8 text-slate-950">
            {currentItem.prompt}
            {currentItem.required ? (
              <span className="ml-1 text-red-600" aria-label="required">
                *
              </span>
            ) : null}
          </h2>

          {currentItem.helpText ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">{currentItem.helpText}</p>
          ) : null}

          <div className="mt-8">
            {(currentItem.type === "SINGLE_CHOICE" || currentItem.type === "LIKERT") && (
              <div className="space-y-3">
                {currentItem.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name={currentItem.id}
                      checked={response?.optionIds.includes(option.id) ?? false}
                      disabled={saving}
                      onChange={() => void save(currentItem, { optionIds: [option.id] })}
                      className="mt-1"
                    />
                    <span className="text-sm leading-6 text-slate-800">{option.label}</span>
                  </label>
                ))}
              </div>
            )}

            {currentItem.type === "MULTIPLE_CHOICE" && (
              <div className="space-y-3">
                {currentItem.options.map((option) => {
                  const selected = response?.optionIds.includes(option.id) ?? false;

                  return (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={saving}
                        onChange={() => {
                          const current = response?.optionIds ?? [];
                          const next = selected
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id];

                          if (next.length > 0) {
                            void save(currentItem, { optionIds: next });
                          }
                        }}
                        className="mt-1"
                      />
                      <span className="text-sm leading-6 text-slate-800">{option.label}</span>
                    </label>
                  );
                })}
                <p className="text-xs text-slate-500">
                  At least one option must remain selected once this question has been answered.
                </p>
              </div>
            )}

            {currentItem.type === "BOOLEAN" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    disabled={saving}
                    onClick={() => void save(currentItem, { booleanValue: value })}
                    className={`rounded-xl border px-5 py-4 text-sm font-semibold ${
                      response?.booleanValue === value
                        ? "border-blue-700 bg-blue-50 text-blue-800"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {value ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            )}

            {currentItem.type === "NUMERIC" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const value = Number(form.get("numericValue"));

                  if (Number.isFinite(value)) {
                    void save(currentItem, { numericValue: value });
                  }
                }}
                className="max-w-md"
              >
                <input
                  key={`${currentItem.id}-${response?.numericValue ?? ""}`}
                  name="numericValue"
                  type="number"
                  step="any"
                  required
                  defaultValue={response?.numericValue ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-3 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save answer
                </button>
              </form>
            )}

            {currentItem.type === "TEXT" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const value = String(form.get("textValue") ?? "").trim();

                  if (value) {
                    void save(currentItem, { textValue: value });
                  }
                }}
              >
                <textarea
                  key={`${currentItem.id}-${response?.textValue ?? ""}`}
                  name="textValue"
                  required
                  rows={6}
                  defaultValue={response?.textValue ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-3 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save answer
                </button>
              </form>
            )}
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => {
                setCurrentIndex((index) => Math.max(0, index - 1));
                setError("");
                setSaveMessage("");
              }}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>

            <div className="flex gap-3">
              {currentIndex < items.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentIndex((index) => Math.min(items.length - 1, index + 1));
                    setError("");
                    setSaveMessage("");
                  }}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || saving}
                  onClick={() => void handleSubmit()}
                  className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit assessment"}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
