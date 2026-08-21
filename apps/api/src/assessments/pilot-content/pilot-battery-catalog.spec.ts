import { describe, expect, it } from "vitest";
import {
  PILOT_BATTERIES,
  PILOT_CAREER_FIT_BANDS,
  PILOT_PROFILE_BANDS,
} from "./pilot-battery-catalog";

const expectedCounts = new Map([
  ["SCHOOL_6_8", 60],
  ["SCHOOL_9_10", 75],
  ["SCHOOL_11_12", 90],
  ["COLLEGE", 90],
  ["PROFESSIONAL", 80],
  ["SKILLED_WORKFORCE", 70],
]);

describe("EduMall pilot battery catalogue", () => {
  it("defines all six product segments with the frozen item counts", () => {
    expect(PILOT_BATTERIES).toHaveLength(6);
    expect(new Set(PILOT_BATTERIES.map((battery) => battery.segment)).size).toBe(6);
    for (const battery of PILOT_BATTERIES) {
      const expectedCount = expectedCounts.get(battery.segment);
      if (expectedCount === undefined) {
        throw new Error(`Missing expected item count for ${battery.segment}`);
      }
      expect(battery.items).toHaveLength(expectedCount);
    }
  });

  it("uses response-based pilot governance rather than fabricated norms", () => {
    const serialized = JSON.stringify(PILOT_BATTERIES).toLowerCase();
    expect(serialized).not.toContain("scientifically validated");
    for (const battery of PILOT_BATTERIES) {
      expect(battery.validationStatus).toBe("PILOT_RESEARCH_NOT_NORMED");
      expect(battery.normMode).toBe("THEORETICAL_RANGE_PASS_THROUGH");
      expect(battery.careerFitAlgorithmKey).toBe("weighted-scaled-raw");
      expect(battery.counselorValidationNotice).toContain("validated by your Counselor");
    }
  });

  it("adds the employment decision safeguard only to employment-facing products", () => {
    for (const battery of PILOT_BATTERIES) {
      if (battery.segment === "PROFESSIONAL" || battery.segment === "SKILLED_WORKFORCE") {
        expect(battery.employmentDecisionNotice).toContain("sole basis for recruitment");
      } else {
        expect(battery.employmentDecisionNotice).toBeNull();
      }
    }
  });

  it("keeps item, construct and career-fit provenance internally consistent", () => {
    for (const battery of PILOT_BATTERIES) {
      expect(new Set(battery.items.map((item) => item.code)).size).toBe(battery.items.length);
      expect(new Set(battery.constructs.map((construct) => construct.code)).size).toBe(
        battery.constructs.length,
      );
      const constructCodes = new Set(battery.constructs.map((construct) => construct.code));

      for (const item of battery.items) {
        expect(constructCodes.has(item.constructCode)).toBe(true);
        expect(item.options).toHaveLength(item.type === "LIKERT" ? 5 : 4);
        if (item.type === "LIKERT") {
          expect([...item.options.map((option) => option.score)].sort()).toEqual([1, 2, 3, 4, 5]);
        } else {
          expect(item.options.filter((option) => option.score === 1)).toHaveLength(1);
          expect(item.options.filter((option) => option.score === 0)).toHaveLength(3);
        }
      }

      for (const construct of battery.constructs) {
        const constructItems = battery.items.filter(
          (item) => item.constructCode === construct.code,
        );
        const minimum = constructItems.reduce(
          (sum, item) => sum + Math.min(...item.options.map((option) => option.score)),
          0,
        );
        const maximum = constructItems.reduce(
          (sum, item) => sum + Math.max(...item.options.map((option) => option.score)),
          0,
        );
        expect(construct.theoreticalMinimum).toBe(minimum);
        expect(construct.theoreticalMaximum).toBe(maximum);
        expect(maximum).toBeGreaterThan(minimum);
      }

      for (const path of battery.careerPaths) {
        expect(path.factors.length).toBeGreaterThanOrEqual(3);
        for (const factor of path.factors) {
          expect(constructCodes.has(factor.constructCode)).toBe(true);
          expect(factor.weight).toBeGreaterThan(0);
          expect(factor.direction).toBe("POSITIVE");
        }
      }
    }
  });

  it("uses learning preference language rather than claiming a learning-style treatment effect", () => {
    for (const battery of PILOT_BATTERIES) {
      for (const construct of battery.constructs.filter(
        (entry) => entry.reportSection === "LEARNING_PROFILE",
      )) {
        expect(construct.name.toLowerCase()).toContain("preference");
      }
    }
  });

  it("defines complete non-overlapping 0-100 pilot interpretation and CareerFit bands", () => {
    expect(PILOT_PROFILE_BANDS[0]?.scaledMin).toBe(0);
    expect(PILOT_PROFILE_BANDS.at(-1)?.scaledMax).toBe(100);
    expect(PILOT_CAREER_FIT_BANDS[0]?.lower).toBe(0);
    expect(PILOT_CAREER_FIT_BANDS.at(-1)?.upper).toBe(100);
  });
});
