import { describe, expect, it } from "vitest";
import {
  WEIGHTED_SCALED_RAW_CAREER_FIT_KEY,
  WEIGHTED_SCALED_RAW_CAREER_FIT_VERSION,
  weightedScaledRawCareerFitAlgorithm,
} from "./weighted-scaled-raw-career-fit.algorithm";

function input() {
  return {
    schemaVersion: "career-fit-execution-input-v1" as const,
    scoring: {
      scoringRunId: "run-1",
      scoringVersion: "score-v1",
      scoringAlgorithmVersion: "explicit-option-key-v1",
      scoringInputHash: "a".repeat(64),
    },
    norms: {
      normGroupId: "reference-group-1",
      normGroupCode: "PILOT_RESPONSE_SCALE",
      normSetId: "reference-set-1",
      normVersion: "pilot-response-scale-v1",
    },
    model: {
      careerFitModelId: "model-1",
      modelVersion: "pilot-v1",
      algorithmKey: WEIGHTED_SCALED_RAW_CAREER_FIT_KEY,
      algorithmVersion: WEIGHTED_SCALED_RAW_CAREER_FIT_VERSION,
    },
    taxonomy: {
      taxonomyVersionId: "taxonomy-1",
      taxonomyVersion: "pilot-v1",
    },
    careerPaths: [
      {
        careerPathId: "path-a",
        careerPathCode: "A",
        careerPathName: "Path A",
        careerClusterId: "cluster-1",
        careerClusterCode: "C1",
        careerClusterName: "Cluster 1",
        factors: [
          {
            factorId: "factor-a",
            assessmentConstructId: "construct-1",
            weight: "2",
            direction: "POSITIVE",
            configuration: { minimum: 4, maximum: 20 },
            sourceReference: "pilot-theoretical-range",
            metrics: {
              normApplicationId: "reference-1",
              rawScore: "16",
              standardizedScore: null,
              percentile: null,
            },
          },
        ],
      },
      {
        careerPathId: "path-b",
        careerPathCode: "B",
        careerPathName: "Path B",
        careerClusterId: "cluster-1",
        careerClusterCode: "C1",
        careerClusterName: "Cluster 1",
        factors: [
          {
            factorId: "factor-b",
            assessmentConstructId: "construct-1",
            weight: "2",
            direction: "POSITIVE",
            configuration: { minimum: 4, maximum: 20 },
            sourceReference: "pilot-theoretical-range",
            metrics: {
              normApplicationId: "reference-1",
              rawScore: "8",
              standardizedScore: null,
              percentile: null,
            },
          },
        ],
      },
    ],
  };
}

describe("weightedScaledRawCareerFitAlgorithm", () => {
  it("scales governed theoretical raw-score ranges without requiring a percentile", () => {
    const results = weightedScaledRawCareerFitAlgorithm.execute(input());

    expect(results).toHaveLength(2);
    expect(results[0]?.score).toBe("75.00000000");
    expect(results[1]?.score).toBe("25.00000000");
    expect(results[0]?.evidenceData).toMatchObject({
      metric: "THEORETICAL_RANGE_SCALED_RAW_SCORE",
      normativePercentileUsed: false,
    });
  });

  it("rejects invalid raw-scale configuration", () => {
    const candidate = input();
    candidate.careerPaths[0]!.factors[0]!.configuration = { minimum: 20, maximum: 4 };

    expect(() => weightedScaledRawCareerFitAlgorithm.execute(candidate)).toThrow(
      "invalid governed raw-score range",
    );
  });
});
