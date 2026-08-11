"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../../lib/api";
import {
  cancelAdminAssessmentAssignment,
  createAdminAssessmentAssignment,
  listAdminAssessmentAssignments,
  listEligibleAssessmentCandidates,
  type AdminAssessmentAssignment,
  type EligibleAssessmentCandidate,
} from "../../../lib/admin-assignments";
import {
  listAssessmentDefinitions,
  type AssessmentDefinitionSummary,
} from "../../../lib/assessments";
import { getSession, type AuthSession } from "../../../lib/auth";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function localDateTimeToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

export default function AdminAssignmentsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [definitions, setDefinitions] = useState<AssessmentDefinitionSummary[]>([]);
  const [candidates, setCandidates] = useState<EligibleAssessmentCandidate[]>([]);
  const [assignments, setAssignments] = useState<AdminAssessmentAssignment[]>([]);
  const [assessmentVersionId, setAssessmentVersionId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [availableFrom, setAvailableFrom] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingTenantData, setLoadingTenantData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isSuperAdmin = session?.session.role === "SUPER_ADMIN";

  const publishedVersions = useMemo(
    () =>
      definitions.flatMap((definition) =>
        definition.versions
          .filter((version) => version.status === "PUBLISHED")
          .map((version) => ({
            ...version,
            definitionCode: definition.code,
            definitionOrganizationId: definition.organizationId,
          })),
      ),
    [definitions],
  );

  async function loadBaseData() {
    setLoading(true);
    setError("");

    try {
      const [auth, assessmentDefinitions] = await Promise.all([
        getSession(),
        listAssessmentDefinitions(),
      ]);

      setSession(auth);
      setDefinitions(assessmentDefinitions);

      if (auth.session.role === "ORGANIZATION_ADMIN") {
        const [eligibleCandidates, currentAssignments] = await Promise.all([
          listEligibleAssessmentCandidates(),
          listAdminAssessmentAssignments(),
        ]);

        setCandidates(eligibleCandidates);
        setAssignments(currentAssignments);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to load assignment administration.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  async function loadTenantData() {
    if (!organizationId.trim()) {
      setError("Enter an organization ID first.");
      return;
    }

    setLoadingTenantData(true);
    setError("");
    setMessage("");

    try {
      const [eligibleCandidates, currentAssignments] = await Promise.all([
        listEligibleAssessmentCandidates(organizationId.trim()),
        listAdminAssessmentAssignments(organizationId.trim()),
      ]);

      setCandidates(eligibleCandidates);
      setAssignments(currentAssignments);
      setCandidateId("");
      setMessage("Organization assignment data loaded.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to load organization assignment data.",
      );
    } finally {
      setLoadingTenantData(false);
    }
  }

  async function refreshAssignments() {
    const currentOrganizationId = isSuperAdmin ? organizationId.trim() : undefined;

    setAssignments(await listAdminAssessmentAssignments(currentOrganizationId || undefined));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!assessmentVersionId || !candidateId) {
      setError("Select both an assessment and a candidate.");
      return;
    }

    if (maxAttempts < 1 || maxAttempts > 20) {
      setError("Maximum attempts must be between 1 and 20.");
      return;
    }

    const availableFromIso = localDateTimeToIso(availableFrom);
    const expiresAtIso = localDateTimeToIso(expiresAt);

    if (availableFromIso && expiresAtIso && new Date(availableFromIso) >= new Date(expiresAtIso)) {
      setError("Expiry must be later than the availability time.");
      return;
    }

    if (isSuperAdmin && !organizationId.trim()) {
      setError("Select an organization before assigning an assessment.");
      return;
    }

    setSubmitting(true);

    try {
      await createAdminAssessmentAssignment({
        ...(isSuperAdmin ? { organizationId: organizationId.trim() } : {}),
        assessmentVersionId,
        userId: candidateId,
        maxAttempts,
        ...(availableFromIso ? { availableFrom: availableFromIso } : {}),
        ...(expiresAtIso ? { expiresAt: expiresAtIso } : {}),
      });

      await refreshAssignments();

      setCandidateId("");
      setAssessmentVersionId("");
      setMaxAttempts(1);
      setAvailableFrom("");
      setExpiresAt("");
      setMessage("Assessment assigned successfully.");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to create the assessment assignment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(assignment: AdminAssessmentAssignment) {
    if (
      !window.confirm(
        `Cancel the assignment of "${assignment.assessmentVersion.title}" for ${assignment.user.firstName} ${assignment.user.lastName}? Existing attempt history will be preserved.`,
      )
    ) {
      return;
    }

    setCancellingId(assignment.id);
    setError("");
    setMessage("");

    try {
      await cancelAdminAssessmentAssignment(assignment.id);
      await refreshAssignments();
      setMessage("Assignment cancelled. Existing history was preserved.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to cancel this assessment assignment.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8">
        <p className="text-sm text-slate-600">Loading assignment administration...</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Assessment delivery
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Assignments</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Assign published assessment versions to eligible students or employees. Assignment history
          and candidate attempts are preserved for auditability.
        </p>
      </header>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-base font-semibold text-slate-950">Select organization</h2>
          <p className="mt-1 text-sm text-slate-600">
            Platform administrators must explicitly choose the tenant whose assignments they are
            managing.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              placeholder="Organization UUID"
              className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              disabled={loadingTenantData || !organizationId.trim()}
              onClick={() => void loadTenantData()}
              className="min-h-11 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {loadingTenantData ? "Loading..." : "Load organization"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-slate-950">Create assignment</h2>

        {isSuperAdmin && !organizationId.trim() ? (
          <p className="mt-3 text-sm text-amber-700">
            Enter and load an organization before creating assignments.
          </p>
        ) : null}

        <form onSubmit={handleCreate} className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Published assessment</span>
            <select
              required
              value={assessmentVersionId}
              onChange={(event) => setAssessmentVersionId(event.target.value)}
              disabled={isSuperAdmin && !organizationId.trim()}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              <option value="">Select assessment</option>
              {publishedVersions
                .filter((version) => {
                  if (!isSuperAdmin) {
                    return true;
                  }

                  return (
                    version.definitionOrganizationId === null ||
                    version.definitionOrganizationId === organizationId.trim()
                  );
                })
                .map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.definitionCode} — {version.title} — v{version.versionNumber} —{" "}
                    {version.edition}/{version.form}
                  </option>
                ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-800">Candidate</span>
            <select
              required
              value={candidateId}
              onChange={(event) => setCandidateId(event.target.value)}
              disabled={isSuperAdmin && (!organizationId.trim() || candidates.length === 0)}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              <option value="">Select student or employee</option>
              {candidates.map((candidate) => (
                <option key={candidate.membershipId} value={candidate.id}>
                  {candidate.firstName} {candidate.lastName} — {candidate.email} — {candidate.role}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-800">Maximum attempts</span>
            <input
              required
              type="number"
              min={1}
              max={20}
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div />

          <label className="block">
            <span className="text-sm font-medium text-slate-800">Available from</span>
            <span className="ml-2 text-xs text-slate-500">optional</span>
            <input
              type="datetime-local"
              value={availableFrom}
              onChange={(event) => setAvailableFrom(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-800">Expires at</span>
            <span className="ml-2 text-xs text-slate-500">optional</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={
                submitting ||
                (isSuperAdmin && !organizationId.trim()) ||
                candidates.length === 0 ||
                publishedVersions.length === 0
              }
              className="min-h-11 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "Assigning..." : "Assign assessment"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-950">
            Current and historical assignments
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {assignments.length} assignment
            {assignments.length === 1 ? "" : "s"} shown.
          </p>
        </div>

        {assignments.length === 0 ? (
          <div className="p-8 text-sm text-slate-600">
            {isSuperAdmin && !organizationId.trim()
              ? "Load an organization to view assignments."
              : "No assignments have been created for this organization."}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignments.map((assignment) => (
              <article key={assignment.id} className="p-6">
                <div className="flex flex-col justify-between gap-5 xl:flex-row">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">
                        {assignment.assessmentVersion.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          assignment.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : assignment.status === "CANCELLED"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-700">
                      {assignment.user.firstName} {assignment.user.lastName} ·{" "}
                      {assignment.user.email}
                    </p>

                    <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-slate-500">Assessment</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {assignment.assessmentVersion.assessmentDefinition.code} · v
                          {assignment.assessmentVersion.versionNumber}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Attempts</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {assignment.attempts.length} created / {assignment.maxAttempts} max
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Available from</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {formatDate(assignment.availableFrom)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Expires</dt>
                        <dd className="mt-1 font-medium text-slate-800">
                          {formatDate(assignment.expiresAt)}
                        </dd>
                      </div>
                    </dl>

                    {assignment.attempts.length > 0 ? (
                      <div className="mt-5 rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Attempts
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {assignment.attempts.map((attempt) => (
                            <span
                              key={attempt.id}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                            >
                              #{attempt.attemptNumber} · {attempt.status}
                              {attempt.submittedAt
                                ? ` · submitted ${formatDate(attempt.submittedAt)}`
                                : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {assignment.status === "ACTIVE" ? (
                    <button
                      type="button"
                      disabled={cancellingId === assignment.id}
                      onClick={() => void handleCancel(assignment)}
                      className="h-fit shrink-0 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancellingId === assignment.id ? "Cancelling..." : "Cancel assignment"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
