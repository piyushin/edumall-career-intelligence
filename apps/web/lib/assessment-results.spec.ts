import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateAssessmentReportSnapshot,
  getAssessmentReportReadiness,
} from "./assessment-results";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("assessment report workflow API client", () => {
  it("loads governed report readiness", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "NOT_READY",
          scoringRunId: null,
          publishedNormGroups: [],
          publishedInterpretationSets: [],
          latestSnapshot: null,
          canGenerate: false,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await getAssessmentReportReadiness("11111111-1111-4111-8111-111111111111");

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/staff/assessment-results/11111111-1111-4111-8111-111111111111/report-readiness",
    );
  });

  it("uses CSRF protection when generating a report snapshot", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            csrfToken: "csrf-token",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "snapshot-id",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );

    await generateAssessmentReportSnapshot("11111111-1111-4111-8111-111111111111", {
      normGroupId: "22222222-2222-4222-8222-222222222222",
      interpretationSetId: "33333333-3333-4333-8333-333333333333",
    });

    const mutation = fetchMock.mock.calls[1];

    expect(String(mutation?.[0])).toContain("/report-snapshot");

    expect((mutation?.[1]?.headers as Headers).get("x-csrf-token")).toBe("csrf-token");
  });
});
