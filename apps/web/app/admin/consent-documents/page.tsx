"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../../../lib/api";
import { getSession } from "../../../lib/auth";
import {
  createConsentDocument,
  listConsentDocuments,
  publishConsentDocument,
  retireConsentDocument,
  type AdminConsentDocument,
} from "../../../lib/consent-admin";
import type { ConsentDocumentType } from "../../../lib/consent";

const DOCUMENT_TYPES: ConsentDocumentType[] = ["PRIVACY_NOTICE", "ASSESSMENT_DATA_PROCESSING"];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  PUBLISHED: "bg-green-50 text-green-800 border-green-200",
  RETIRED: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatDate(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default function AdminConsentDocumentsPage() {
  const [documents, setDocuments] = useState<AdminConsentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  const [type, setType] = useState<ConsentDocumentType>("PRIVACY_NOTICE");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const session = await getSession();
      const superAdmin = session.session.role === "SUPER_ADMIN";

      setIsSuperAdmin(superAdmin);

      if (superAdmin) {
        setDocuments(await listConsentDocuments());
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to load consent documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setMessage("");

    try {
      await createConsentDocument({ type, version: version.trim(), title: title.trim(), bodyText });
      setVersion("");
      setTitle("");
      setBodyText("");
      setMessage("Draft created.");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to create this document.");
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      await publishConsentDocument(id);
      setMessage("Document published.");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to publish this document.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRetire(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");

    try {
      await retireConsentDocument(id);
      setMessage("Document retired.");
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to retire this document.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Consent documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Legal text a candidate (or their guardian) must accept before taking an assessment
          (D-013). Only one document per type may be published at a time.
        </p>
      </div>

      {isSuperAdmin === false ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Consent document authoring is available only to platform super administrators, since legal
          text applies platform-wide rather than per organization.
        </p>
      ) : null}

      {isSuperAdmin ? (
        <>
          <form
            onSubmit={handleCreate}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
          >
            <h2 className="text-base font-semibold text-slate-950">New draft</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as ConsentDocumentType)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                >
                  {DOCUMENT_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-800">Version</span>
                <input
                  type="text"
                  required
                  placeholder="v1"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">Title</span>
              <input
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">Body text</span>
              <span className="ml-2 text-xs text-slate-500">
                Placeholder text is acceptable in a draft; publish only reviewed legal copy.
              </span>
              <textarea
                required
                rows={6}
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create draft"}
            </Button>
          </form>

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-600">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No consent documents yet. Create a draft above, then publish it once the legal text
              has been reviewed.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Title / version</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Published</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td className="px-4 py-3 text-slate-700">
                        {document.type.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{document.title}</p>
                        <p className="text-xs text-slate-500">{document.version}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[document.status]}`}
                        >
                          {document.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(document.publishedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {document.status === "DRAFT" ? (
                          <button
                            type="button"
                            disabled={busyId === document.id}
                            onClick={() => void handlePublish(document.id)}
                            className="text-sm font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-60"
                          >
                            Publish
                          </button>
                        ) : null}
                        {document.status === "PUBLISHED" ? (
                          <button
                            type="button"
                            disabled={busyId === document.id}
                            onClick={() => void handleRetire(document.id)}
                            className="text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-60"
                          >
                            Retire
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
