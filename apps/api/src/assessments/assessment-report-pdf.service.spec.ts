import { describe, expect, it } from "vitest";
import { AssessmentReportPdfService } from "./assessment-report-pdf.service";
import type { AssessmentReleasedReportPdfSource } from "./assessment-report-view.service";

function source(
  overrides: Partial<AssessmentReleasedReportPdfSource> = {},
): AssessmentReleasedReportPdfSource {
  return {
    releasedAt: new Date("2026-01-02T00:00:00Z"),
    candidateName: "Asha Patel",
    organizationName: "Gandhinagar Model School",
    assessment: {
      title: "Career Aptitude Assessment",
      edition: "2026",
      form: "A",
      language: "en",
    },
    results: [
      {
        constructCode: "logic",
        constructName: "Logic",
        outputData: { band: "Strong" },
      },
    ],
    ...overrides,
  };
}

describe("AssessmentReportPdfService", () => {
  it("renders a valid PDF document", async () => {
    const service = new AssessmentReportPdfService();

    const pdf = await service.render(source());

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
    // PDF magic bytes; also proves pdfkit produced a well-formed document, not just bytes.
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1").trim()).toBe("%%EOF");
  });

  it("renders without throwing when there are no results", async () => {
    const service = new AssessmentReportPdfService();

    const pdf = await service.render(source({ results: [] }));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders without throwing when releasedAt is null", async () => {
    const service = new AssessmentReportPdfService();

    const pdf = await service.render(source({ releasedAt: null }));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
