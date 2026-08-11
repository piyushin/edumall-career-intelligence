"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { getSession, logout, type AuthSession } from "../lib/auth";

type CandidateShellState =
  | { status: "loading" }
  | { status: "ready"; session: AuthSession }
  | { status: "forbidden" }
  | { status: "error" };

export function CandidateShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<CandidateShellState>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = await getSession();

        if (!active) {
          return;
        }

        if (session.session.role !== "STUDENT" && session.session.role !== "EMPLOYEE") {
          setState({ status: "forbidden" });
          return;
        }

        setState({ status: "ready", session });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        setState({ status: "error" });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  async function handleLogout() {
    setSigningOut(true);

    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <p className="text-sm text-slate-600">Loading your assessment workspace...</p>
      </main>
    );
  }

  if (state.status === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Candidate access required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This workspace is available only to authorized student and employee accounts.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Return to login
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Workspace unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We could not load your candidate session. Please try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <Link href="/candidate/assessments" className="text-lg font-semibold text-slate-950">
              EduMall Career
            </Link>
            <p className="text-xs text-slate-500">Candidate assessment workspace</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">
                {state.session.user.email ?? "Candidate"}
              </p>
              <p className="text-xs text-slate-500">
                {state.session.session.role === "STUDENT" ? "Student" : "Employee"}
              </p>
            </div>

            <button
              type="button"
              disabled={signingOut}
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
