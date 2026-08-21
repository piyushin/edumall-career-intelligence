import { describe, expect, it } from "vitest";
import {
  CAREER_FIT_VALIDATION_NOTICE,
  COUNSELOR_VALIDATION_NOTICE,
  resolveAssessmentProductSegment,
} from "./assessment-product-segment";

describe("assessment product segment governance", () => {
  it("preserves the exact counselor and CareerFit validation notices", () => {
    expect(COUNSELOR_VALIDATION_NOTICE).toBe(
      "Important: This inference is based on your responses to this assessment and the assessment model used for interpretation. Please get these findings validated by your Counselor before making important educational, career or employment decisions.",
    );
    expect(CAREER_FIT_VALIDATION_NOTICE).toBe(
      "Career recommendations are indicative, not prescriptive. They are derived from your assessment responses and should be discussed and validated with your Counselor.",
    );
  });

  it("classifies bare UG and PG product codes as college without substring false positives", () => {
    expect(resolveAssessmentProductSegment("UG", "Pilot Research Edition 2026")).toBe("COLLEGE");
    expect(resolveAssessmentProductSegment("PG", "Pilot Research Edition 2026")).toBe("COLLEGE");
    expect(resolveAssessmentProductSegment("DRUG_RESEARCH", "Pilot Research Edition 2026")).toBe(
      "SCHOOL_11_12",
    );
  });
});
