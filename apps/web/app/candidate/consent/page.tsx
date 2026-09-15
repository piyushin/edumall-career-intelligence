"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../../../lib/api";
import {
  acceptConsentDocument,
  getConsentRequirements,
  recordDateOfBirth,
  type ConsentRequirementItem,
  type ConsentRequirements,
} from "../../../lib/consent";

function requirementKey(requirement: ConsentRequirementItem): string {
  return `${requirement.documentType}:${requirement.role}`;
}

function roleLabel(role: ConsentRequirementItem["role"]): string {
  if (role === "GUARDIAN") return "Parent/guardian consent";
  if (role === "STUDENT_ASSENT") return "Your assent";
  return "Your consent";
}

function DateOfBirthForm({ onRecorded }: { onRecorded: (result: ConsentRequirements) => void }) {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const result = await recordDateOfBirth(dateOfBirth);
      onRecorded(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to save your date of birth.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-slate-950">Confirm your date of birth</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        We ask this once, before your first assessment, because candidates under 18 require a parent
        or guardian&apos;s consent alongside their own.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block max-w-xs">
          <span className="text-sm font-medium text-slate-800">Date of birth</span>
          <input
            type="date"
            required
            value={dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setDateOfBirth(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={submitting || !dateOfBirth}>
          {submitting ? "Saving..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}

function RequirementCard({
  requirement,
  onAccepted,
}: {
  requirement: ConsentRequirementItem;
  onAccepted: (result: ConsentRequirements) => void;
}) {
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isGuardian = requirement.role === "GUARDIAN";

  async function handleAccept() {
    if (!requirement.documentId) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await acceptConsentDocument({
        consentDocumentId: requirement.documentId,
        acceptedByRole: requirement.role,
        ...(isGuardian ? { guardianName, guardianEmail, guardianRelationship } : {}),
      });

      onAccepted(result);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to record your consent.");
    } finally {
      setSubmitting(false);
    }
  }

  if (requirement.satisfied) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-900">
          ✓ {roleLabel(requirement.role)} — {requirement.documentTitle}
        </p>
      </div>
    );
  }

  if (!requirement.documentId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-900">
          {roleLabel(requirement.role)} is not yet available
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Your organization has not published this consent document yet. Please check back shortly
          or contact your organization administrator.
        </p>
      </div>
    );
  }

  const canAccept =
    agreed && (!isGuardian || (guardianName && guardianEmail && guardianRelationship));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        {roleLabel(requirement.role)}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-950">{requirement.documentTitle}</h2>
      <p className="mt-1 text-xs text-slate-500">Version {requirement.documentVersion}</p>

      <div className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {requirement.documentBodyText}
      </div>

      {isGuardian ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-slate-600">
            To be completed by the candidate&apos;s parent or guardian.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Guardian full name</span>
            <input
              type="text"
              required
              value={guardianName}
              onChange={(event) => setGuardianName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Guardian email</span>
            <input
              type="email"
              required
              value={guardianEmail}
              onChange={(event) => setGuardianEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block max-w-xs">
            <span className="text-sm font-medium text-slate-800">Relationship to candidate</span>
            <input
              type="text"
              required
              placeholder="e.g. Mother, Father, Guardian"
              value={guardianRelationship}
              onChange={(event) => setGuardianRelationship(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      ) : null}

      <label className="mt-5 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          {isGuardian
            ? "I am the candidate's parent or guardian and I agree to the above on their behalf."
            : "I have read and agree to the above."}
        </span>
      </label>

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <Button className="mt-4" onClick={handleAccept} disabled={!canAccept || submitting}>
        {submitting ? "Saving..." : "I agree"}
      </Button>
    </div>
  );
}

export default function CandidateConsentPage() {
  const router = useRouter();
  const [requirements, setRequirements] = useState<ConsentRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getConsentRequirements()
      .then((result) => {
        if (active) setRequirements(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : "Unable to load consent status.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (requirements?.complete) {
      router.replace("/candidate/assessments");
    }
  }, [requirements, router]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-950">Before you begin</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        A few required confirmations before you can take an assessment.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading...</p>
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : !requirements ? null : requirements.dateOfBirthRequired ? (
        <div className="mt-6">
          <DateOfBirthForm onRecorded={setRequirements} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {requirements.requirements.map((requirement) => (
            <RequirementCard
              key={requirementKey(requirement)}
              requirement={requirement}
              onAccepted={setRequirements}
            />
          ))}
        </div>
      )}
    </main>
  );
}
