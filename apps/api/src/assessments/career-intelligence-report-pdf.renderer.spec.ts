import { describe, expect, it } from "vitest";
import { CareerIntelligenceReportPdfRenderer } from "./career-intelligence-report-pdf.renderer";

describe("CareerIntelligenceReportPdfRenderer", () => {
  it("renders a governed v3 Career Intelligence PDF", async () => {
    const renderer = new CareerIntelligenceReportPdfRenderer();
    const constructId = "11111111-1111-4111-8111-111111111111";

    const rankedCareerPaths = Array.from({ length: 10 }, (_, index) => ({
      careerPathId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      careerPathCode: `PATH-${index + 1}`,
      careerPathName: `Career Path ${index + 1}`,
      careerPathDescription: `Published description for Career Path ${index + 1}.`,
      careerClusterId: "22222222-2222-4222-8222-222222222222",
      careerClusterCode: "CLUSTER-1",
      careerClusterName: "Career Cluster One",
      careerClusterDescription: "Published cluster description.",
      score: String(95 - index),
      rank: index + 1,
      recommendationBand: {
        id: "33333333-3333-4333-8333-333333333333",
        code: "STRONG",
        label: "Strong alignment",
        outputData: { summary: "Published recommendation interpretation." },
      },
      evidence: { summary: "Recorded deterministic model evidence." },
    }));

    const buffer = await renderer.render({
      id: "44444444-4444-4444-8444-444444444444",
      inputHash: "a".repeat(64),
      reportVersion: "career-report-v1",
      generatedAt: "2026-08-14T08:00:00.000Z",
      payload: {
        schemaVersion: "assessment-report-data-v3",
        candidate: {
          userId: "55555555-5555-4555-8555-555555555555",
          email: "candidate@example.com",
          firstName: "Test",
          lastName: "Candidate",
        },
        submission: {
          attemptId: "66666666-6666-4666-8666-666666666666",
          startedAt: "2026-08-14T06:00:00.000Z",
          submittedAt: "2026-08-14T07:00:00.000Z",
        },
        assessment: {
          assessmentVersionId: "77777777-7777-4777-8777-777777777777",
          assessmentDefinitionCode: "CAREER",
          versionNumber: 1,
          title: "Career Intelligence Assessment",
          edition: "2026",
          form: "A",
          language: "en",
          scoringVersion: "score-v1",
          normVersion: "norm-v1",
          reportVersion: "career-report-v1",
        },
        scoring: {
          scoringRunId: "88888888-8888-4888-8888-888888888888",
          attemptId: "66666666-6666-4666-8666-666666666666",
          scoringVersion: "score-v1",
          algorithmVersion: "explicit-option-key-v1",
          scoringInputHash: "b".repeat(64),
          calculatedAt: "2026-08-14T07:01:00.000Z",
          constructs: [
            {
              assessmentConstructId: constructId,
              code: "PERSONALITY-1",
              name: "Career Personality Construct",
              description: "Published construct description.",
              metadata: { reportSection: "PERSONALITY" },
              orderIndex: 1,
              rawScore: "12.5",
              answeredItemCount: 10,
              contributionCount: 10,
            },
          ],
        },
        norms: [
          {
            assessmentConstructId: constructId,
            standardizedScore: "55",
            percentile: "72.5",
          },
        ],
        interpretation: {
          interpretationSetId: "99999999-9999-4999-8999-999999999999",
          version: "interpret-v1",
          name: "Published Interpretation",
          applications: [
            {
              assessmentConstructId: constructId,
              ruleCode: "RULE-1",
              metric: "PERCENTILE",
              metricValue: "72.5",
              outputData: { summary: "Published construct interpretation." },
            },
          ],
        },
        careerFit: {
          careerFitRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          inputHash: "c".repeat(64),
          algorithmKey: "career-fit",
          algorithmVersion: "1",
          calculatedAt: "2026-08-14T07:02:00.000Z",
          model: { name: "CareerFit Model", version: "1" },
          taxonomy: { version: "2026", edition: "India", locale: "en-IN" },
          rankedCareerPaths,
        },
        reportComposition: {
          templateId: "career-intelligence-student",
          templateVersion: "1",
          audience: "CANDIDATE",
          locale: "en-IN",
          productSegment: "SCHOOL_11_12",
          reportNotice:
            "Important: This inference is based on your responses to this assessment and the assessment model used for interpretation. Please get these findings validated by your Counselor before making important educational, career or employment decisions.",
          careerFitNotice:
            "Career recommendations are indicative, not prescriptive. They are derived from your assessment responses and should be discussed and validated with your Counselor.",
          employmentDecisionNotice: null,
        },
      },
    });

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(7000);
    expect(buffer.subarray(buffer.length - 20).toString()).toContain("%%EOF");
  });
});
