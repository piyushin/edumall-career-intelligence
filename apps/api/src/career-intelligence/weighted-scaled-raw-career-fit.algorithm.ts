import {
  CareerFitAlgorithmExecutionError,
  type CareerFitAlgorithmDefinition,
} from "./career-fit-algorithm.registry";

export const WEIGHTED_SCALED_RAW_CAREER_FIT_KEY = "weighted-scaled-raw";
export const WEIGHTED_SCALED_RAW_CAREER_FIT_VERSION = "1.0.0";

interface RawScaleConfiguration {
  minimum: number;
  maximum: number;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number(value);
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

function scaleConfiguration(value: unknown, factorId: string): RawScaleConfiguration {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_RAW_SCALE_CONFIGURATION_REQUIRED",
      `Career-fit factor ${factorId} requires a governed raw-score minimum and maximum.`,
    );
  }

  const record = value as Record<string, unknown>;
  const minimum = finiteNumber(record.minimum);
  const maximum = finiteNumber(record.maximum);

  if (minimum === null || maximum === null || maximum <= minimum) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_RAW_SCALE_CONFIGURATION_INVALID",
      `Career-fit factor ${factorId} has an invalid governed raw-score range.`,
    );
  }

  return { minimum, maximum };
}

function scaledRawScore(rawValue: string, configuration: RawScaleConfiguration, factorId: string) {
  const rawScore = finiteNumber(rawValue);
  if (rawScore === null) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_RAW_SCORE_INVALID",
      `Career-fit factor ${factorId} has an invalid raw score.`,
    );
  }

  if (rawScore < configuration.minimum || rawScore > configuration.maximum) {
    throw new CareerFitAlgorithmExecutionError(
      "CAREER_FIT_RAW_SCORE_OUT_OF_RANGE",
      `Career-fit factor ${factorId} raw score is outside its governed theoretical range.`,
    );
  }

  return (
    ((rawScore - configuration.minimum) / (configuration.maximum - configuration.minimum)) * 100
  );
}

function fixed(value: number): string {
  return value.toFixed(8);
}

export const weightedScaledRawCareerFitAlgorithm: CareerFitAlgorithmDefinition = {
  key: WEIGHTED_SCALED_RAW_CAREER_FIT_KEY,
  version: WEIGHTED_SCALED_RAW_CAREER_FIT_VERSION,
  rankOrder: "DESC",

  validateConfiguration: ({ factors, recommendationBands }) => {
    const issues = [];

    for (const factor of factors) {
      const weight = finiteNumber(factor.weight);
      if (weight === null || weight <= 0) {
        issues.push({
          code: "CAREER_FIT_FACTOR_WEIGHT_INVALID",
          message: "Weighted scaled-raw CareerFit requires every factor weight to be positive.",
          factorId: factor.id,
        });
      }

      const configuration = factor.configuration;
      if (
        typeof configuration !== "object" ||
        configuration === null ||
        Array.isArray(configuration)
      ) {
        issues.push({
          code: "CAREER_FIT_RAW_SCALE_CONFIGURATION_REQUIRED",
          message: "Each factor requires configuration.minimum and configuration.maximum.",
          factorId: factor.id,
        });
        continue;
      }

      const record = configuration as Record<string, unknown>;
      const minimum = finiteNumber(record.minimum);
      const maximum = finiteNumber(record.maximum);
      if (minimum === null || maximum === null || maximum <= minimum) {
        issues.push({
          code: "CAREER_FIT_RAW_SCALE_CONFIGURATION_INVALID",
          message: "Each factor requires a valid theoretical raw-score range.",
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
            message: `Weighted scaled-raw recommendation ${label} bounds must be between 0 and 100.`,
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
        const configuration = scaleConfiguration(factor.configuration, factor.factorId);
        const scaled = scaledRawScore(factor.metrics.rawScore, configuration, factor.factorId);
        const adjusted = factor.direction === "NEGATIVE" ? 100 - scaled : scaled;
        const weightedContribution = adjusted * weight;

        totalWeight += weight;
        weightedTotal += weightedContribution;

        return {
          factorId: factor.factorId,
          assessmentConstructId: factor.assessmentConstructId,
          referenceApplicationId: factor.metrics.normApplicationId,
          rawScore: factor.metrics.rawScore,
          theoreticalMinimum: fixed(configuration.minimum),
          theoreticalMaximum: fixed(configuration.maximum),
          scaledRawScore: fixed(scaled),
          direction: factor.direction,
          approvedWeight: fixed(weight),
          adjustedScaledRawScore: fixed(adjusted),
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
          schemaVersion: "career-fit-weighted-scaled-raw-evidence-v1",
          algorithmKey: WEIGHTED_SCALED_RAW_CAREER_FIT_KEY,
          algorithmVersion: WEIGHTED_SCALED_RAW_CAREER_FIT_VERSION,
          metric: "THEORETICAL_RANGE_SCALED_RAW_SCORE",
          normativePercentileUsed: false,
          formula:
            "sum(direction-adjusted theoretical-range scaled raw score x approved weight) / sum(approved weight)",
          totalWeight: fixed(totalWeight),
          score: fixed(score),
          factors,
        },
      };
    }),
};
