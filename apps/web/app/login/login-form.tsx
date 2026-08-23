"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "../../components/brand-logo";
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
      if (result.session.role === "COUNSELLOR") {
        router.replace(next?.startsWith("/staff") ? next : "/staff/results");
        router.refresh();
        return;
      }
      await logout();
      setError("This account does not currently have access to this workspace.");
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff8f3] via-white to-orange-50 px-5 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-orange-100 bg-white shadow-2xl shadow-orange-100 lg:grid-cols-2">
        <section className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-9 text-white lg:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <Link href="/" className="relative inline-block rounded-2xl bg-white px-4 py-2 shadow-lg">
            <BrandLogo className="h-auto w-[180px]" priority />
          </Link>
          <p className="relative mt-10 text-xs font-black uppercase tracking-[0.18em] text-orange-100">
            Career Intelligence Platform
          </p>
          <h1 className="relative mt-4 text-4xl font-black leading-tight">
            Welcome back to your career journey.
          </h1>
          <p className="relative mt-5 max-w-md text-sm leading-7 text-red-50">
            One secure login automatically takes candidates to assessments, counsellors to results,
            and administrators to their management workspace.
          </p>
          <div className="relative mt-8 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm leading-6">
            New candidate? Create an account, choose your segment and your relevant assessment will
            be assigned automatically.
          </div>
        </section>
        <section className="p-8 sm:p-10 lg:p-12">
          <p className="text-sm font-extrabold text-red-600">Secure login</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use your authorised EduMall Career account.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
              />
            </label>
            <details className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer font-bold text-slate-600">
                Organisation access code (only if your organisation provided one)
              </summary>
              <input
                type="text"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-4 focus:ring-red-50"
              />
            </details>
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
              >
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-red-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>
          <div className="mt-7 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">New candidate?</p>
            <Link
              href="/signup"
              className="mt-2 inline-flex rounded-xl border border-red-200 px-5 py-2.5 text-sm font-black text-red-600 hover:bg-red-50"
            >
              Create an account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
