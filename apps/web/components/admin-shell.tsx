"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@edumall/ui";
import { ApiError } from "../lib/api";
import { hasPermission, isPlatformSession, roleLabel } from "../lib/admin-authorization";
import { getSession, logout, type AuthSession } from "../lib/auth";
import { AdminSessionProvider } from "./admin-session";
import { BrandLogo } from "./brand-logo";

const allowedRoles = new Set(["SUPER_ADMIN", "PLATFORM_ADMIN", "ORGANIZATION_ADMIN"]);

interface NavItem {
  label: string;
  href: string;
  permission?: string;
  permissions?: string[];
  platformOnly?: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin", permission: "admin.view", platformOnly: true }],
  },
  {
    label: "People",
    items: [
      {
        label: "Candidates / Users",
        href: "/admin/users",
        permission: "candidate.view",
        platformOnly: true,
      },
      {
        label: "Organizations",
        href: "/admin/organizations",
        permission: "organization.view",
        platformOnly: true,
      },
      {
        label: "Administrators",
        href: "/admin/access",
        permission: "admin.view",
        platformOnly: true,
      },
      {
        label: "Roles & permissions",
        href: "/admin/access/roles",
        permission: "admin.view",
        platformOnly: true,
      },
    ],
  },
  {
    label: "Career Intelligence",
    items: [
      { label: "Assessments", href: "/admin/assessments", permission: "assessment.view" },
      {
        label: "Assignments",
        href: "/admin/assignments",
        permissions: ["assessment.view", "candidate.view"],
      },
      { label: "Reports", href: "/admin/reports", permission: "report.search" },
    ],
  },
  {
    label: "Governance",
    items: [{ label: "Audit", href: "/admin/audit", permission: "audit.view", platformOnly: true }],
  },
];

function canSee(session: AuthSession, item: NavItem): boolean {
  if (item.platformOnly && !isPlatformSession(session)) return false;
  if (item.permissions)
    return item.permissions.every((permission) => hasPermission(session, permission));
  if (item.permission) return hasPermission(session, item.permission);
  return false;
}

function NavLinks({ session, pathname }: { session: AuthSession; pathname: string }) {
  return (
    <nav aria-label="Administration navigation" className="space-y-6">
      {groups.map((group) => {
        const items = group.items.filter((item) => canSee(session, item));
        if (!items.length) return null;
        return (
          <section key={group.label}>
            <h2 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {group.label}
            </h2>
            <div className="space-y-1">
              {items.map((item) => {
                const itemPath = item.href.split("?")[0] ?? item.href;
                const active =
                  itemPath === "/admin" ? pathname === itemPath : pathname.startsWith(itemPath);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-red-50 text-red-700" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const initialPath = useRef(pathname);
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

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
          router.replace(`/login?next=${encodeURIComponent(initialPath.current)}`);
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setState("forbidden");
          return;
        }
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (state === "loading")
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" aria-busy="true">
        <p className="text-sm text-slate-600">Checking your secure session…</p>
      </main>
    );
  if (state === "forbidden")
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section
          role="alert"
          className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-2xl font-semibold text-slate-950">Access denied</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your current account does not have an active administrative session for this workspace.
          </p>
        </section>
      </main>
    );
  if (state === "error" || !session)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section
          role="alert"
          className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-2xl font-semibold text-slate-950">Admin workspace unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your session could not be checked. No privileged information was loaded.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </section>
      </main>
    );

  return (
    <AdminSessionProvider session={session}>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-4">
              <BrandLogo className="h-auto w-[112px]" />
              <div className="hidden border-l border-slate-200 pl-4 sm:block">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-600">
                  Control Centre
                </p>
                <p className="text-sm font-semibold text-slate-950">Career Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-slate-900">
                  {session.user.email ?? "Administrator"}
                </p>
                <p className="text-xs text-slate-500">{roleLabel(session.session.role)}</p>
              </div>
              <Button variant="secondary" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 lg:py-8">
          <details className="mb-5 rounded-xl border border-slate-200 bg-white p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Control Centre navigation
            </summary>
            <div className="mt-4">
              <NavLinks session={session} pathname={pathname} />
            </div>
          </details>
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <NavLinks session={session} pathname={pathname} />
            </div>
          </aside>
          <main id="main-content" className="min-w-0 pb-12">
            {children}
          </main>
        </div>
      </div>
    </AdminSessionProvider>
  );
}
