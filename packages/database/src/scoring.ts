const SCALE = 10_000n;
const RESULT_SCALE = SCALE * SCALE;

export type ScoringContribution = {
  constructId: string;
  itemId: string;
  score: string;
  weight?: string;
};

export type ConstructRawScore = {
  constructId: string;
  rawScore: string;
  answeredItemCount: number;
  contributionCount: number;
};

function parseFixed4(value: string): bigint {
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(value)) {
    throw new Error(`Invalid fixed-4 decimal: ${value}`);
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const scaled = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"));

  return negative ? -scaled : scaled;
}

function formatFixed8(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / RESULT_SCALE;
  const fraction = (absolute % RESULT_SCALE).toString().padStart(8, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/// Deterministically aggregates explicit option/key scores.
///
/// score and weight are fixed to at most 4 decimal places.
/// Multiplication therefore produces an exact fixed-8 result.
///
/// This function deliberately does not infer norms, reverse-score
/// ranges, percentile conversions, interpretations, or recommendations.
export function calculateConstructRawScores(
  contributions: readonly ScoringContribution[],
): ConstructRawScore[] {
  const accumulators = new Map<
    string,
    {
      total: bigint;
      itemIds: Set<string>;
      contributionCount: number;
    }
  >();

  for (const contribution of contributions) {
    if (!contribution.constructId) {
      throw new Error("constructId is required");
    }

    if (!contribution.itemId) {
      throw new Error("itemId is required");
    }

    const score = parseFixed4(contribution.score);
    const weight = parseFixed4(contribution.weight ?? "1");
    const weightedScore = score * weight;

    const current = accumulators.get(contribution.constructId) ?? {
      total: 0n,
      itemIds: new Set<string>(),
      contributionCount: 0,
    };

    current.total += weightedScore;
    current.itemIds.add(contribution.itemId);
    current.contributionCount += 1;

    accumulators.set(contribution.constructId, current);
  }

  return [...accumulators.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([constructId, value]) => ({
      constructId,
      rawScore: formatFixed8(value.total),
      answeredItemCount: value.itemIds.size,
      contributionCount: value.contributionCount,
    }));
}
