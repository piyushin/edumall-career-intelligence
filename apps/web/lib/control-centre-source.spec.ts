import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const routeSources = [
  "../app/admin/page.tsx",
  "../app/admin/access/page.tsx",
  "../app/admin/access/[adminId]/page.tsx",
  "../app/admin/access/roles/page.tsx",
  "../app/admin/audit/page.tsx",
  "../app/admin/organizations/page.tsx",
  "../app/admin/organizations/[organizationId]/page.tsx",
  "../app/admin/users/page.tsx",
  "../app/admin/users/[userId]/page.tsx",
];

describe("R19.1C source security and launch route contract", () => {
  it("implements every required real Control Centre route", () => {
    for (const relative of routeSources) expect(() => source(relative), relative).not.toThrow();
  });

  it("does not render or persist credential and token material", () => {
    const combined = routeSources.map(source).join("\n");
    expect(combined).not.toMatch(/passwordHash|tokenHash|resetToken|localStorage|sessionStorage/);
    expect(combined).not.toContain("raw invitation token");
  });

  it("models invitation delivery honestly and protects system-role actions", () => {
    const access = source("../app/admin/access/page.tsx");
    const roles = source("../app/admin/access/roles/page.tsx");
    expect(access).toContain("BLOCKED_CONFIGURATION");
    expect(access).toContain("email delivery is not configured");
    expect(roles).toContain("Protected system role · read only");
    expect(roles).toContain("!role.isSystem");
  });

  it("implements dashboard loading, error, empty and retry states without fake metrics", () => {
    const dashboard = source("../app/admin/page.tsx");
    expect(dashboard).toContain("LoadingSkeleton");
    expect(dashboard).toContain("ErrorState");
    expect(dashboard).toContain("No dashboard data");
    expect(dashboard).toContain("retry={() => void load()}");
    expect(dashboard).not.toMatch(/mock|placeholder metric|sample total/i);
  });

  it("suppresses unauthorized API effects and includes responsive navigation", () => {
    const shell = source("../components/admin-shell.tsx");
    const pages = routeSources.map(source).join("\n");
    expect(shell).toContain("permission");
    expect(shell).toContain("lg:hidden");
    expect(shell).toContain("hidden lg:block");
    expect(pages.match(/if \(!authorized\)/g)?.length).toBeGreaterThanOrEqual(9);
  });

  it("suppresses legacy assessment requests and commerce projections without permission", () => {
    const assessments = source("../app/admin/assessments/page.tsx");
    const assessmentDetail = source("../app/admin/assessments/[definitionId]/page.tsx");
    const assignments = source("../app/admin/assignments/page.tsx");
    const organizationDetail = source("../app/admin/organizations/[organizationId]/page.tsx");
    expect(assessments).toContain("if (!canView)");
    expect(assessmentDetail).toContain("if (!canView)");
    expect(assignments).toContain("if (!authorized)");
    expect(organizationDetail).toContain('hasPermission(session, "commerce.view")');
  });

  it("keeps existing assessment and assignment operations in navigation", () => {
    const shell = source("../components/admin-shell.tsx");
    expect(shell).toContain("/admin/assessments");
    expect(shell).toContain("/admin/assignments");
    expect(shell).toContain('label: "Reports", href: "/admin/reports"');
    expect(shell).not.toContain("/staff/results");
  });

  it("handles expired and forbidden sessions as distinct security outcomes", () => {
    const shell = source("../components/admin-shell.tsx");
    const api = source("./api.ts");
    expect(shell).toContain("/login?next=");
    expect(shell).toContain("error.status === 403");
    expect(shell).toContain("Access denied");
    expect(api).toContain("response.status === 401");
    expect(api).toContain("status === 403");
  });
});
