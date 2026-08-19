import {
  CareerFitAlgorithmExecutionError,
  type CareerFitAlgorithmDefinition,
} from "./career-fit-algorithm.registry";

export const WEIGHTED_PERCENTILE_CAREER_FIT_KEY = "weighted-percentile";
export const WEIGHTED_PERCENTILE_CAREER_FIT_VERSION = "1.0.0";

function finiteNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveWeight(value: string, factorId: string): number {
  const weight = finiteNumber(value);

  if (weight === null || weight <= 0) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_FACTOR_WEIGHT_INVALID",
      `Career-fit factor ${factorId} must use a positive finite weight.`,
    );
  }

  return weight;
}

function percentileValue(value: string | null, factorId: string): number {
  if (value === null) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_PERCENTILE_REQUIRED",
      `Career-fit factor ${factorId} requires a published percentile norm result.`,
    );
  }

  const percentile = finiteNumber(value);

  if (percentile === null || percentile < 0 || percentile > 100) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_PERCENTILE_INVALID",
      `Career-fit factor ${factorId} has an invalid percentile norm result.`,
    );
  }

  return percentile;
}

function fixed(value: number): string {
  return value.toFixed(8);
}

export const weightedPercentileCareerFitAlgorithm: CareerFitAlgorithmDefinition = {
  key: WEIGHTED_PERCENTILE_CAREER_FIT_KEY,
  version: WEIGHTED_PERCENTILE_CAREER_FIT_VERSION,
  rankOrder: "DESC",

  validateConfiguration: ({ factors, recommendationBands }) => {
    const issues = [];

    for (const factor of factors) {
      const weight = finiteNumber(factor.weight);

      if (weight === null || weight <= 0) {
        issues.push({
          code: "CAREER_FIT_FACTOR_WEIGHT_INVALID",
          message: "Weighted-percentile CareerFit requires every factor weight to be positive.",
          factorId: factor.id,
        });
      }
    }

    for (const band of recommendationBands) {
      for (const [label, value] of [
        ["lower", band.lowerBound],
        ["upper", band.upperBound],
      ] as const) {
        if (value === null) continue;

        const bound = finiteNumber(value);
        if (bound === null || bound < 0 || bound > 100) {
          issues.push({
            code: "CAREER_FIT_RECOMMENDATION_BOUND_INVALID",
            message: `Weighted-percentile recommendation ${label} bounds must be between 0 and 100.`,
            recommendationBandId: band.id,
          });
        }
      }
    }

    return issues;
  },

  execute: (input) =>
    input.careerPaths.map((path) => {
      let totalWeight = 0;
      let weightedTotal = 0;

      const factors = path.factors.map((factor) => {
        const weight = positiveWeight(factor.weight, factor.factorId);
        const percentile = percentileValue(factor.metrics.percentile, factor.factorId);
        const adjustedPercentile = factor.direction === "NEGATIVE" ? 100 - percentile : percentile;
        const weightedContribution = adjustedPercentile * weight;

        totalWeight += weight;
        weightedTotal += weightedContribution;

        return {
          factorId: factor.factorId,
          assessmentConstructId: factor.assessmentConstructId,
          normApplicationId: factor.metrics.normApplicationId,
          percentile: fixed(percentile),
          direction: factor.direction,
          approvedWeight: fixed(weight),
          adjustedPercentile: fixed(adjustedPercentile),
          weightedContribution: fixed(weightedContribution),
          sourceReference: factor.sourceReference,
        };
      });

      if (totalWeight <= 0) {
        throw new CareerFitAlgorithmExecutionError(
          "CAREER_FIT_PATH_WEIGHT_INVALID",
          `Career path ${path.careerPathId} does not have a positive total factor weight.`,
        );
      }

      const score = weightedTotal / totalWeight;

      return {
        careerPathId: path.careerPathId,
        score: fixed(score),
        evidenceData: {
          schemaVersion: "career-fit-weighted-percentile-evidence-v1",
          algorithmKey: WEIGHTED_PERCENTILE_CAREER_FIT_KEY,
          algorithmVersion: WEIGHTED_PERCENTILE_CAREER_FIT_VERSION,
          metric: "PERCENTILE",
          formula: "sum(direction-adjusted percentile x approved weight) / sum(approved weight)",
          totalWeight: fixed(totalWeight),
          score: fixed(score),
          factors,
        },
      };
    }),
};
