"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@edumall/ui";
import { ApiError } from "../../lib/api";
import { login, logout } from "../../lib/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login({
        email: email.trim(),
        password,
        ...(organizationId.trim() ? { organizationId: organizationId.trim() } : {}),
      });

      const next = searchParams.get("next");

      if (result.session.role === "SUPER_ADMIN" || result.session.role === "ORGANIZATION_ADMIN") {
        router.replace(next?.startsWith("/admin") ? next : "/admin");
        router.refresh();
        return;
      }

      if (result.session.role === "STUDENT" || result.session.role === "EMPLOYEE") {
        router.replace(next?.startsWith("/candidate") ? next : "/candidate/assessments");
        router.refresh();
        return;
      }

      await logout();
      setError("This account does not currently have access to this workspace.");
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
        <section className="hidden bg-blue-800 p-12 text-white lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-100">
            The EduMall
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">
            Career Intelligence Platform
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
            Manage versioned assessments, scoring configuration, publication lifecycle, and future
            candidate delivery from one controlled platform.
          </p>
        </section>

        <section className="p-8 sm:p-12">
          <p className="text-sm font-semibold text-blue-700">Secure login</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use your authorized EduMall account. Candidates must sign in within their organization.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">Organization ID</span>
              <span className="ml-2 text-xs text-slate-500">
                optional where not required by your account
              </span>
              <input
                type="text"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
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

            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
