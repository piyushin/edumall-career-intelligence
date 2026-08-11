"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { getSession, logout, type AuthSession } from "../lib/auth";

const allowedRoles = new Set(["SUPER_ADMIN", "ORGANIZATION_ADMIN", "COUNSELLOR"]);

type StaffState =
  | { status: "loading" }
  | { status: "ready"; session: AuthSession }
  | { status: "forbidden" }
  | { status: "error" };

export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<StaffState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    getSession()
      .then((session) => {
        if (!active) return;

        if (!allowedRoles.has(session.session.role)) {
          setState({ status: "forbidden" });
          return;
        }

        setState({ status: "ready", session });
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        setState({ status: "error" });
      });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (state.status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading results workspace...</p>
      </main>
    );
  }

  if (state.status === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-semibold text-slate-950">Staff access required</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Assessment results are available only to authorized administrators and counsellors.
          </p>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-8">
          <h1 className="text-2xl font-semibold text-slate-950">Results workspace unavailable</h1>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              The EduMall
            </p>
            <p className="text-lg font-semibold text-slate-950">Assessment Results</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{state.session.user.email}</p>
              <p className="text-xs text-slate-500">
                {state.session.session.role.replaceAll("_", " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <nav className="mb-8">
          <Link
            href="/staff/results"
            className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
          >
            Results
          </Link>
        </nav>

        {children}
      </div>
    </div>
  );
}
