import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "./api";
import { reportPlatformApi } from "./report-platform";

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

afterEach(() => vi.restoreAllMocks());

describe("R20-C1 report operations", () => {
  it("uses dedicated admin and staff report APIs with encoded search and pagination", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            items: [],
            pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          }),
          { status: 200 },
        ),
    );
    await reportPlatformApi.adminList({ candidateName: "Asha Patel", mobile: "+91 98", page: "1" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_BASE_URL}/admin/reports?candidateName=Asha+Patel&mobile=%2B91+98&page=1`,
    );
    await reportPlatformApi.staffDetail("attempt/id");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_BASE_URL}/staff/reports/attempt%2Fid`);
  });

  it("provides name, mobile and email search and displays generation state", () => {
    const admin = source("../app/admin/reports/page.tsx");
    expect(admin).toContain('label="Candidate name"');
    expect(admin).toContain('label="Mobile"');
    expect(admin).toContain('label="Email"');
    expect(admin).toContain("generationStatus");
    expect(admin).toContain("Report access required");
    expect(admin).toContain("canViewFullReport");
  });

  it("keeps staff scope server-derived and never exposes a full-report action without access", () => {
    const list = source("../app/staff/reports/page.tsx");
    expect(list).not.toMatch(/organizationId|Organization UUID/);
    expect(list).toContain("item.canViewFullReport && item.generationStatus");
    expect(list).toContain("Report access required");
    expect(list).toContain("View record");
  });

  it("uses generation and entitlement state in Candidate 360 and only labels releases as history", () => {
    const candidate = source("../app/admin/users/[userId]/page.tsx");
    expect(candidate).toContain("phoneE164");
    expect(candidate).toContain("reportGeneration.status");
    expect(candidate).toContain("/admin/reports/${attempt.id}");
    expect(candidate).not.toContain("_count.reportReleases");
    expect(candidate).toContain("Legacy release history");
  });

  it("removes obsolete normal release language and introduces no public pilot copy", () => {
    const paths = [
      "../components/admin-shell.tsx",
      "../app/admin/reports/page.tsx",
      "../app/admin/reports/[attemptId]/page.tsx",
      "../app/admin/users/[userId]/page.tsx",
      "../app/staff/reports/page.tsx",
      "../app/staff/reports/[attemptId]/page.tsx",
    ];
    const combined = paths.map(source).join("\n");
    expect(combined).not.toMatch(
      /Reports & releases|Awaiting Release|Review & Release|Release to Candidate|not released|Counselor review/,
    );
    expect(combined).not.toMatch(/pilot/i);
  });
});
