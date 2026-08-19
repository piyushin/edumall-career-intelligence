import { describe, expect, it } from "vitest";
import type { CareerFitAlgorithmExecutionInput } from "./career-fit-algorithm.registry";
import {
  WEIGHTED_PERCENTILE_CAREER_FIT_KEY,
  WEIGHTED_PERCENTILE_CAREER_FIT_VERSION,
  weightedPercentileCareerFitAlgorithm,
} from "./weighted-percentile-career-fit.algorithm";

function input(
  percentiles: Array<{
    percentile: string | null;
    direction?: "POSITIVE" | "NEGATIVE";
    weight: string;
  }>,
): CareerFitAlgorithmExecutionInput {
  return {
    schemaVersion: "career-fit-execution-input-v1",
    scoring: {
      scoringRunId: "11111111-1111-4111-8111-111111111111",
      scoringVersion: "score-v1",
      scoringAlgorithmVersion: "explicit-option-key-v1",
      scoringInputHash: "a".repeat(64),
    },
    norms: {
      normGroupId: "22222222-2222-4222-8222-222222222222",
      normGroupCode: "DEFAULT",
      normSetId: "33333333-3333-4333-8333-333333333333",
      normVersion: "norm-v1",
    },
    model: {
      careerFitModelId: "44444444-4444-4444-8444-444444444444",
      modelVersion: "1",
      algorithmKey: WEIGHTED_PERCENTILE_CAREER_FIT_KEY,
      algorithmVersion: WEIGHTED_PERCENTILE_CAREER_FIT_VERSION,
    },
    taxonomy: {
      taxonomyVersionId: "55555555-5555-4555-8555-555555555555",
      taxonomyVersion: "1",
    },
    careerPaths: [
      {
        careerPathId: "66666666-6666-4666-8666-666666666666",
        careerPathCode: "TECH",
        careerPathName: "Technology",
        careerClusterId: "77777777-7777-4777-8777-777777777777",
        careerClusterCode: "STEM",
        careerClusterName: "STEM",
        factors: percentiles.map((entry, index) => ({
          factorId: `factor-${index + 1}`,
          assessmentConstructId: `construct-${index + 1}`,
          weight: entry.weight,
          direction: entry.direction ?? "POSITIVE",
          configuration: null,
          sourceReference: "approved-source",
          metrics: {
            normApplicationId: `norm-${index + 1}`,
            rawScore: "4",
            standardizedScore: "55",
            percentile: entry.percentile,
          },
        })),
      },
    ],
  };
}

describe("weightedPercentileCareerFitAlgorithm", () => {
  it("calculates a deterministic weighted mean on the percentile scale", () => {
    const [result] = weightedPercentileCareerFitAlgorithm.execute(
      input([
        { percentile: "80", weight: "3" },
        { percentile: "60", weight: "1" },
      ]),
    );

    expect(result?.score).toBe("75.00000000");
    expect(result?.evidenceData).toMatchObject({
      metric: "PERCENTILE",
      totalWeight: "4.00000000",
    });
  });

  it("reverses percentile direction only when the governed factor direction is negative", () => {
    const [result] = weightedPercentileCareerFitAlgorithm.execute(
      input([{ percentile: "20", direction: "NEGATIVE", weight: "1" }]),
    );

    expect(result?.score).toBe("80.00000000");
  });

  it("refuses execution when a required percentile is missing", () => {
    expect(() =>
      weightedPercentileCareerFitAlgorithm.execute(input([{ percentile: null, weight: "1" }])),
    ).toThrow(/requires a published percentile norm result/);
  });

  it("rejects non-positive factor weights during publication readiness", () => {
    const issues = weightedPercentileCareerFitAlgorithm.validateConfiguration?.({
      factors: [
        {
          id: "factor-1",
          careerPathId: "path-1",
          assessmentConstructId: "construct-1",
          weight: "0",
          direction: "POSITIVE",
          configuration: null,
        },
      ],
      recommendationBands: [],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "CAREER_FIT_FACTOR_WEIGHT_INVALID",
        factorId: "factor-1",
      }),
    ]);
  });
});
