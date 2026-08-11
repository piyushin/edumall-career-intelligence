import { describe, expect, it } from "vitest";
import { AssessmentReportPdfService } from "./assessment-report-pdf.service";

describe("AssessmentReportPdfService", () => {
  it("renders a valid multi-section PDF from an immutable report snapshot", async () => {
    const service = new AssessmentReportPdfService();

    const buffer = await service.render({
      id: "11111111-1111-4111-8111-111111111111",
      inputHash: "a".repeat(64),
      reportVersion: "report-v1",
      generatedAt: "2026-08-11T10:00:00.000Z",
      payload: {
        schemaVersion: "assessment-report-data-v2",
        candidate: {
          userId: "22222222-2222-4222-8222-222222222222",
          email: "candidate@example.com",
          firstName: "Test",
          lastName: "Candidate",
        },
        submission: {
          attemptId: "33333333-3333-4333-8333-333333333333",
          startedAt: "2026-08-11T08:00:00.000Z",
          submittedAt: "2026-08-11T08:30:00.000Z",
        },
        assessment: {
          assessmentVersionId: "44444444-4444-4444-8444-444444444444",
          assessmentDefinitionCode: "TEST",
          versionNumber: 1,
          title: "Career Assessment",
          edition: "2026",
          form: "A",
          language: "en",
          scoringVersion: "score-v1",
          normVersion: "norm-v1",
          reportVersion: "report-v1",
        },
        scoring: {
          scoringRunId: "55555555-5555-4555-8555-555555555555",
          attemptId: "33333333-3333-4333-8333-333333333333",
          scoringVersion: "score-v1",
          algorithmVersion: "explicit-option-key-v1",
          scoringInputHash: "b".repeat(64),
          calculatedAt: "2026-08-11T08:31:00.000Z",
          constructs: [
            {
              assessmentConstructId: "66666666-6666-4666-8666-666666666666",
              code: "C1",
              name: "Construct One",
              orderIndex: 1,
              rawScore: "12.50000000",
              answeredItemCount: 10,
              contributionCount: 10,
            },
          ],
        },
        norms: [
          {
            assessmentConstructId: "66666666-6666-4666-8666-666666666666",
            standardizedScore: "55",
            percentile: "72.5",
          },
        ],
        interpretation: {
          interpretationSetId: "77777777-7777-4777-8777-777777777777",
          version: "interpret-v1",
          name: "Published Interpretation",
          applications: [
            {
              assessmentConstructId: "66666666-6666-4666-8666-666666666666",
              ruleCode: "RULE-1",
              metric: "PERCENTILE",
              metricValue: "72.5",
              outputData: {
                band: "documented-band",
              },
            },
          ],
        },
      },
    });

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

    expect(buffer.length).toBeGreaterThan(1500);

    expect(buffer.subarray(buffer.length - 20).toString()).toContain("%%EOF");
  });
});
