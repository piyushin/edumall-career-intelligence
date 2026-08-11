import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelAdminAssessmentAssignment,
  createAdminAssessmentAssignment,
  listAdminAssessmentAssignments,
  listEligibleAssessmentCandidates,
} from "./admin-assignments";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("admin assessment assignment API client", () => {
  it("adds an organization query only when supplied", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await listAdminAssessmentAssignments("11111111-1111-4111-8111-111111111111");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "organizationId=11111111-1111-4111-8111-111111111111",
    );
  });

  it("loads eligible candidates without an organization query for tenant admins", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await listEligibleAssessmentCandidates();

    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /\/admin\/assessment-assignments\/candidates$/,
    );
  });

  it("creates assignments through the protected mutation API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "assignment-id" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await createAdminAssessmentAssignment({
      assessmentVersionId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      maxAttempts: 2,
    });

    const mutation = fetchMock.mock.calls[1];

    expect(String(mutation?.[0])).toContain("/admin/assessment-assignments");
    expect((mutation?.[1]?.headers as Headers).get("x-csrf-token")).toBe("csrf-token");
  });

  it("cancels assignments through the protected mutation API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "11111111-1111-4111-8111-111111111111",
            organizationId: "22222222-2222-4222-8222-222222222222",
            status: "CANCELLED",
            cancelledAt: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await cancelAdminAssessmentAssignment("11111111-1111-4111-8111-111111111111");

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/admin/assessment-assignments/11111111-1111-4111-8111-111111111111/cancel",
    );
  });
});
