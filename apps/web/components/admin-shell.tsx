"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../lib/api";
import { getSession, logout, type AuthSession } from "../lib/auth";

const allowedRoles = new Set(["SUPER_ADMIN", "ORGANIZATION_ADMIN"]);

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden">("loading");

  useEffect(() => {
    let active = true;

    getSession()
      .then((result) => {
        if (!active) return;

        if (!allowedRoles.has(result.session.role)) {
          setState("forbidden");
          return;
        }

        setSession(result);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        setState("forbidden");
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

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Checking your session...</p>
      </main>
    );
  }

  if (state === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Access unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This area is available only to authorized platform or organization administrators.
          </p>
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
            <p className="text-lg font-semibold text-slate-950">Career Intelligence Admin</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">
                {session?.user.email ?? "Administrator"}
              </p>
              <p className="text-xs text-slate-500">{session?.session.role.replaceAll("_", " ")}</p>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav className="space-y-1">
            <Link
              href="/admin"
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                pathname === "/admin" ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-white"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/assessments"
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                pathname.startsWith("/admin/assessments")
                  ? "bg-blue-50 text-blue-800"
                  : "text-slate-700 hover:bg-white"
              }`}
            >
              Assessments
            </Link>
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
