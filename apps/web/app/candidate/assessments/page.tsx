"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../../lib/api";
import {
  listCandidateAssignments,
  startOrResumeCandidateAttempt,
  type CandidateAssignment,
} from "../../../lib/candidate-assessments";

function formatDate(value: string | null): string {
  if (!value) {
    return "No limit";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function currentAttempt(assignment: CandidateAssignment) {
  return assignment.attempts.find((attempt) => attempt.status === "IN_PROGRESS");
}

function submittedCount(assignment: CandidateAssignment) {
  return assignment.attempts.filter((attempt) => attempt.status === "SUBMITTED").length;
}

export default function CandidateAssessmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadAssignments() {
    setError("");

    try {
      setAssignments(await listCandidateAssignments());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load your assessments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssignments();
  }, []);

  const visibleAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status !== "CANCELLED"),
    [assignments],
  );

  async function openAssessment(assignment: CandidateAssignment) {
    setWorkingId(assignment.id);
    setError("");

    try {
      const attempt = await startOrResumeCandidateAttempt(assignment.id);
      router.push(`/candidate/assessments/${attempt.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to open this assessment.");
      setWorkingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Candidate workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          My Assessments
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Start a new assessment or continue an assessment already in progress. Your saved responses
          remain attached to your current attempt.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          Loading assessments...
        </div>
      ) : visibleAssignments.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-slate-950">No assessments assigned</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            There are currently no active assessments assigned to your account.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5">
          {visibleAssignments.map((assignment) => {
            const inProgress = currentAttempt(assignment);
            const completed = submittedCount(assignment);
            const attemptLimitReached = !inProgress && completed >= assignment.maxAttempts;
            const now = Date.now();
            const notYetAvailable =
              assignment.availableFrom !== null &&
              new Date(assignment.availableFrom).getTime() > now;
            const expired =
              assignment.expiresAt !== null && new Date(assignment.expiresAt).getTime() <= now;
            const disabled =
              workingId === assignment.id ||
              attemptLimitReached ||
              notYetAvailable ||
              expired ||
              assignment.status !== "ACTIVE";

            return (
              <article
                key={assignment.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-950">
                        {assignment.assessmentVersion.title}
                      </h2>
                      {inProgress ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          In progress
                        </span>
                      ) : completed > 0 ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Submitted
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Not started
                        </span>
                      )}
                    </div>

                    {assignment.assessmentVersion.description ? (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        {assignment.assessmentVersion.description}
                      </p>
                    ) : null}

                    <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-slate-500">Edition / Form</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {assignment.assessmentVersion.edition} /{" "}
                          {assignment.assessmentVersion.form}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Language</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {assignment.assessmentVersion.language}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Attempts</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {completed} of {assignment.maxAttempts} submitted
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Available until</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {formatDate(assignment.expiresAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void openAssessment(assignment)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {workingId === assignment.id
                      ? "Opening..."
                      : inProgress
                        ? "Resume assessment"
                        : attemptLimitReached
                          ? "Attempt limit reached"
                          : notYetAvailable
                            ? "Not yet available"
                            : expired
                              ? "Expired"
                              : "Start assessment"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
