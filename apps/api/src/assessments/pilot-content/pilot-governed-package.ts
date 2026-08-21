import {
  PILOT_BATTERIES,
  PILOT_CAREER_FIT_BANDS,
  PILOT_PROFILE_BANDS,
  type PilotBattery,
  type PilotConstruct,
} from "./pilot-battery-catalog";

export const PILOT_SCIENTIFIC_STATUS = "PILOT_RESEARCH_NOT_NORMED" as const;
export const PILOT_DEPLOYMENT_MODE = "CONTROLLED_PILOT" as const;

export const PILOT_SOURCE_REFERENCE =
  "The EduMall Career Intelligence Pilot Research Edition 2026. Response-based theoretical-score configuration for controlled pilot use; no population norms, percentile norms, or scientific validation claim.";

export interface GovernedPilotPackage {
  segment: PilotBattery["segment"];
  scientificStatus: typeof PILOT_SCIENTIFIC_STATUS;
  deploymentMode: typeof PILOT_DEPLOYMENT_MODE;
  assessment: {
    definition: {
      code: string;
      status: "ACTIVE";
    };
    version: {
      versionNumber: 1;
      status: "PUBLISHED";
      title: string;
      edition: string;
      form: "A";
      language: "en";
      scoringVersion: string;
      normVersion: string;
      reportVersion: string;
      description: string;
      instructions: string;
      deliveryConfig: Record<string, unknown>;
      scoringConfig: Record<string, unknown>;
    };
    constructs: Array<{
      code: string;
      name: string;
      description: string;
      orderIndex: number;
      metadata: Record<string, unknown>;
    }>;
    items: Array<{
      code: string;
      type: "LIKERT" | "SINGLE_CHOICE";
      prompt: string;
      orderIndex: number;
      required: true;
      metadata: Record<string, unknown>;
      constructLink: {
        constructCode: string;
        weight: 1;
        reverseScored: false;
      };
      options: Array<{
        code: string;
        label: string;
        orderIndex: number;
        score: number;
      }>;
    }>;
  };
  responseReference: {
    normSet: {
      normVersion: string;
      name: string;
      description: string;
      sourceReference: string;
      populationMetadata: Record<string, unknown>;
      status: "PUBLISHED";
    };
    group: {
      code: string;
      name: string;
      description: string;
      criteria: Record<string, unknown>;
      sampleSize: null;
      metadata: Record<string, unknown>;
    };
    tables: Array<{
      constructCode: string;
      metadata: Record<string, unknown>;
      row: {
        rawScoreMin: string;
        rawScoreMax: string;
        standardizedScore: null;
        percentile: null;
        metadata: Record<string, unknown>;
      };
    }>;
  };
  interpretation: {
    set: {
      version: string;
      name: string;
      description: string;
      sourceReference: string;
      methodology: Record<string, unknown>;
      status: "PUBLISHED";
    };
    rules: Array<{
      constructCode: string;
      code: string;
      metric: "RAW_SCORE";
      lowerBound: string;
      upperBound: string;
      lowerInclusive: true;
      upperInclusive: true;
      priority: number;
      outputData: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }>;
  };
  career: {
    taxonomy: {
      code: string;
      name: string;
      description: string;
      status: "ACTIVE";
    };
    taxonomyVersion: {
      version: string;
      edition: string;
      locale: "en-IN";
      status: "PUBLISHED";
      sourceReference: string;
      methodology: Record<string, unknown>;
    };
    clusters: Array<{
      code: string;
      name: string;
      description: string;
      orderIndex: number;
      metadata: Record<string, unknown>;
    }>;
    paths: Array<{
      code: string;
      name: string;
      clusterCode: string;
      description: string;
      orderIndex: number;
      metadata: Record<string, unknown>;
    }>;
    model: {
      version: string;
      name: string;
      description: string;
      algorithmKey: "weighted-scaled-raw";
      algorithmVersion: "1.0.0";
      sourceReference: string;
      methodology: Record<string, unknown>;
      status: "PUBLISHED";
    };
    factors: Array<{
      pathCode: string;
      constructCode: string;
      weight: number;
      direction: "POSITIVE" | "NEGATIVE";
      configuration: {
        minimum: number;
        maximum: number;
        basis: "THEORETICAL_RAW_SCORE_RANGE";
        normativePercentileUsed: false;
      };
      rationale: string;
      sourceReference: string;
      orderIndex: number;
    }>;
    recommendationBands: Array<{
      code: string;
      label: string;
      lowerBound: number;
      upperBound: number;
      lowerInclusive: true;
      upperInclusive: true;
      priority: number;
      outputData: Record<string, unknown>;
    }>;
  };
}

function fixed8(value: number): string {
  return value.toFixed(8);
}

function rawFromScaled(construct: PilotConstruct, scaled: number): number {
  return (
    construct.theoreticalMinimum +
    ((construct.theoreticalMaximum - construct.theoreticalMinimum) * scaled) / 100
  );
}

function interpretationNarrative(construct: PilotConstruct, label: string): string {
  const evidenceType =
    construct.kind === "SELF_REPORT" ? "response pattern" : "observed item performance";
  return `Your ${evidenceType} on ${construct.name} falls in the ${label.toLowerCase()} band of this pilot's theoretical scoring range. This is not a population percentile or a diagnostic conclusion. Discuss the result, examples and context with your Counselor before making an important decision.`;
}

function buildPackage(battery: PilotBattery): GovernedPilotPackage {
  const constructsByCode = new Map(
    battery.constructs.map((construct) => [construct.code, construct]),
  );

  const clusters = new Map<
    string,
    {
      code: string;
      name: string;
      description: string;
      orderIndex: number;
      metadata: Record<string, unknown>;
    }
  >();

  battery.careerPaths.forEach((path) => {
    if (!clusters.has(path.clusterCode)) {
      clusters.set(path.clusterCode, {
        code: path.clusterCode,
        name: path.clusterName,
        description: `${path.clusterName} directions included in the ${battery.title} controlled pilot taxonomy.`,
        orderIndex: clusters.size + 1,
        metadata: {
          pilot: true,
          segment: battery.segment,
        },
      });
    }
  });

  let factorOrder = 0;

  return {
    segment: battery.segment,
    scientificStatus: PILOT_SCIENTIFIC_STATUS,
    deploymentMode: PILOT_DEPLOYMENT_MODE,
    assessment: {
      definition: {
        code: battery.code,
        status: "ACTIVE",
      },
      version: {
        versionNumber: battery.versionNumber,
        status: "PUBLISHED",
        title: battery.title,
        edition: battery.edition,
        form: battery.form,
        language: battery.language,
        scoringVersion: battery.scoringVersion,
        normVersion: battery.normVersion,
        reportVersion: battery.reportVersion,
        description: `${battery.title}. Controlled Research/Pilot Edition. Results are developmental, response-based and require Counselor validation.`,
        instructions:
          "Answer independently and as accurately as you can. There are no ideal personality or interest responses. For ability items, choose the best answer. Your report is developmental and should be discussed with your Counselor.",
        deliveryConfig: {
          productSegment: battery.segment,
          expectedMinutes: battery.expectedMinutes,
          pilotMode: true,
          scientificStatus: PILOT_SCIENTIFIC_STATUS,
          counselorValidationNotice: battery.counselorValidationNotice,
          employmentDecisionNotice: battery.employmentDecisionNotice,
        },
        scoringConfig: {
          method: "EXPLICIT_OPTION_SCORE_SUM",
          explicitOptionScoresOnly: true,
          reverseWordingAlreadyKeyedInOptionScores: true,
          inferNorms: false,
          inferPercentiles: false,
        },
      },
      constructs: battery.constructs.map((construct, index) => ({
        code: construct.code,
        name: construct.name,
        description: construct.description,
        orderIndex: index + 1,
        metadata: {
          reportSection: construct.reportSection,
          constructKind: construct.kind,
          theoreticalMinimum: construct.theoreticalMinimum,
          theoreticalMaximum: construct.theoreticalMaximum,
          scientificStatus: PILOT_SCIENTIFIC_STATUS,
          populationNormed: false,
        },
      })),
      items: battery.items.map((item, index) => ({
        code: item.code,
        type: item.type,
        prompt: item.prompt,
        orderIndex: index + 1,
        required: item.required,
        metadata: {
          pilot: true,
          constructCode: item.constructCode,
          wordingReverseKeyed: item.reverseScored,
          scoringKeyStoredExplicitly: true,
        },
        constructLink: {
          constructCode: item.constructCode,
          weight: 1,
          reverseScored: false,
        },
        options: item.options.map((option, optionIndex) => ({
          code: option.code,
          label: option.label,
          orderIndex: optionIndex + 1,
          score: option.score,
        })),
      })),
    },
    responseReference: {
      normSet: {
        normVersion: battery.normVersion,
        name: `${battery.title} - Pilot Response Reference Package`,
        description:
          "Technical pass-through reference package using only each construct's theoretical raw-score range. It contains no empirical population norm, percentile norm or standardized-score claim.",
        sourceReference: PILOT_SOURCE_REFERENCE,
        populationMetadata: {
          mode: battery.normMode,
          populationNorm: false,
          percentileNorm: false,
          standardizedScoreNorm: false,
          sampleSize: null,
          scientificStatus: PILOT_SCIENTIFIC_STATUS,
          controlledPilotOnly: true,
        },
        status: "PUBLISHED",
      },
      group: {
        code: "PILOT_RESPONSE_REFERENCE",
        name: "Pilot response reference - non-normative",
        description:
          "A technical reference group used to preserve pipeline provenance while population norms are unavailable. It must not be interpreted as a normative comparison group.",
        criteria: {
          mode: "THEORETICAL_SCORE_RANGE_ONLY",
          noPopulationComparison: true,
        },
        sampleSize: null,
        metadata: {
          pilot: true,
          populationNorm: false,
        },
      },
      tables: battery.constructs.map((construct) => ({
        constructCode: construct.code,
        metadata: {
          mode: "PASS_THROUGH_THEORETICAL_RANGE",
          populationNorm: false,
        },
        row: {
          rawScoreMin: fixed8(construct.theoreticalMinimum),
          rawScoreMax: fixed8(construct.theoreticalMaximum),
          standardizedScore: null,
          percentile: null,
          metadata: {
            theoreticalRangeOnly: true,
            normativeStatistic: false,
          },
        },
      })),
    },
    interpretation: {
      set: {
        version: battery.interpretationVersion,
        name: `${battery.title} - Pilot Response Interpretation`,
        description:
          "Developmental response-band interpretation based only on the construct's theoretical raw-score range. Not a population-norm or clinical interpretation.",
        sourceReference: PILOT_SOURCE_REFERENCE,
        methodology: {
          metric: "RAW_SCORE",
          bandBasis: "THEORETICAL_RANGE_SCALING",
          populationNorm: false,
          counselorValidationRequired: true,
          scientificStatus: PILOT_SCIENTIFIC_STATUS,
        },
        status: "PUBLISHED",
      },
      rules: battery.constructs.flatMap((construct) =>
        PILOT_PROFILE_BANDS.map((band, index) => ({
          constructCode: construct.code,
          code: `${construct.code}_${band.code}`,
          metric: "RAW_SCORE" as const,
          lowerBound: fixed8(rawFromScaled(construct, band.scaledMin)),
          upperBound: fixed8(rawFromScaled(construct, band.scaledMax)),
          lowerInclusive: true as const,
          upperInclusive: true as const,
          priority: 100 - index,
          outputData: {
            label: band.label,
            narrative: interpretationNarrative(construct, band.label),
            counselorValidationRequired: true,
            populationPercentile: null,
          },
          metadata: {
            pilot: true,
            scaledRange: {
              minimum: band.scaledMin,
              maximum: band.scaledMax,
            },
            rawRangeDerivedFromTheoreticalLimits: true,
            populationNorm: false,
          },
        })),
      ),
    },
    career: {
      taxonomy: {
        code: `EDUMALL_${battery.segment}_PILOT_TAXONOMY`,
        name: `${battery.title} - Pilot Career Taxonomy`,
        description: `Segment-specific career or role exploration taxonomy for ${battery.segment}. Controlled pilot use only.`,
        status: "ACTIVE",
      },
      taxonomyVersion: {
        version: "pilot-2026-v1",
        edition: "Research/Pilot Edition 2026",
        locale: "en-IN",
        status: "PUBLISHED",
        sourceReference: PILOT_SOURCE_REFERENCE,
        methodology: {
          segment: battery.segment,
          developmentalMapping: true,
          empiricallyValidatedWeights: false,
          counselorValidationRequired: true,
          scientificStatus: PILOT_SCIENTIFIC_STATUS,
        },
      },
      clusters: [...clusters.values()],
      paths: battery.careerPaths.map((path, index) => ({
        code: path.code,
        name: path.name,
        clusterCode: path.clusterCode,
        description: path.description,
        orderIndex: index + 1,
        metadata: {
          pilot: true,
          segment: battery.segment,
          recommendationType:
            battery.segment === "SKILLED_WORKFORCE"
              ? "JOB_FAMILY_EXPLORATION"
              : "CAREER_EXPLORATION",
        },
      })),
      model: {
        version: "pilot-response-fit-v1",
        name: `${battery.title} - Response-Based Pilot CareerFit`,
        description:
          "Developmental deterministic alignment model using theoretical-range scaled raw construct scores. Factor weights are pilot configuration and require later empirical validation.",
        algorithmKey: battery.careerFitAlgorithmKey,
        algorithmVersion: battery.careerFitAlgorithmVersion,
        sourceReference: PILOT_SOURCE_REFERENCE,
        methodology: {
          inputMetric: "RAW_SCORE",
          scalingBasis: "THEORETICAL_RAW_SCORE_RANGE",
          normativePercentileUsed: false,
          weightsStatus: "DEVELOPMENTAL_PILOT_CONFIGURATION",
          soleDecisionUseProhibited:
            battery.segment === "PROFESSIONAL" || battery.segment === "SKILLED_WORKFORCE",
          counselorValidationRequired: true,
        },
        status: "PUBLISHED",
      },
      factors: battery.careerPaths.flatMap((path) =>
        path.factors.map((factor) => {
          const construct = constructsByCode.get(factor.constructCode);
          if (!construct) {
            throw new Error(
              `Missing construct ${factor.constructCode} for career path ${path.code} in ${battery.segment}`,
            );
          }
          factorOrder += 1;
          return {
            pathCode: path.code,
            constructCode: factor.constructCode,
            weight: factor.weight,
            direction: factor.direction,
            configuration: {
              minimum: construct.theoreticalMinimum,
              maximum: construct.theoreticalMaximum,
              basis: "THEORETICAL_RAW_SCORE_RANGE" as const,
              normativePercentileUsed: false as const,
            },
            rationale:
              "Developmental pilot mapping for career/job-family exploration. Weight and mapping require empirical validation before any validated-model claim.",
            sourceReference: PILOT_SOURCE_REFERENCE,
            orderIndex: factorOrder,
          };
        }),
      ),
      recommendationBands: PILOT_CAREER_FIT_BANDS.map((band, index) => ({
        code: band.code,
        label: band.label,
        lowerBound: band.lower,
        upperBound: band.upper,
        lowerInclusive: true,
        upperInclusive: true,
        priority: 100 - index,
        outputData: {
          narrative: `${band.label}. This is a response-based pilot alignment signal, not a prediction of success or a population percentile. Validate the recommendation with a Counselor and real-world exploration.`,
          counselorValidationRequired: true,
          normativePercentileUsed: false,
        },
      })),
    },
  };
}

export const GOVERNED_PILOT_PACKAGES: readonly GovernedPilotPackage[] =
  PILOT_BATTERIES.map(buildPackage);

export function getGovernedPilotPackage(segment: PilotBattery["segment"]): GovernedPilotPackage {
  const result = GOVERNED_PILOT_PACKAGES.find((candidate) => candidate.segment === segment);
  if (!result) throw new Error(`Governed pilot package not found for ${segment}`);
  return result;
}
