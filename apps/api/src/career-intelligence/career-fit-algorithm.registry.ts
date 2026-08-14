import { Inject, Injectable } from "@nestjs/common";

export const CAREER_FIT_ALGORITHM_DEFINITIONS = Symbol("CAREER_FIT_ALGORITHM_DEFINITIONS");

export interface CareerFitAlgorithmValidationIssue {
  code: string;
  message: string;
  factorId?: string;
  recommendationBandId?: string;
}

export interface CareerFitAlgorithmValidationContext {
  factors: Array<{
    id: string;
    careerPathId: string;
    assessmentConstructId: string;
    weight: string;
    direction: string;
    configuration: unknown;
  }>;
  recommendationBands: Array<{
    id: string;
    code: string;
    lowerBound: string | null;
    upperBound: string | null;
    lowerInclusive: boolean;
    upperInclusive: boolean;
    priority: number;
    outputData: unknown;
  }>;
}

export type CareerFitRankOrder = "ASC" | "DESC";

export interface CareerFitAlgorithmExecutionFactor {
  factorId: string;
  assessmentConstructId: string;
  weight: string;
  direction: string;
  configuration: unknown;
  sourceReference: string | null;
  metrics: {
    normApplicationId: string;
    rawScore: string;
    standardizedScore: string | null;
    percentile: string | null;
  };
}

export interface CareerFitAlgorithmExecutionPath {
  careerPathId: string;
  careerPathCode: string;
  careerPathName: string;
  careerClusterId: string;
  careerClusterCode: string;
  careerClusterName: string;
  factors: CareerFitAlgorithmExecutionFactor[];
}

export interface CareerFitAlgorithmExecutionInput {
  schemaVersion: "career-fit-execution-input-v1";
  scoring: {
    scoringRunId: string;
    scoringVersion: string;
    scoringAlgorithmVersion: string;
    scoringInputHash: string;
  };
  norms: {
    normGroupId: string;
    normGroupCode: string;
    normSetId: string;
    normVersion: string;
  };
  model: {
    careerFitModelId: string;
    modelVersion: string;
    algorithmKey: string;
    algorithmVersion: string;
  };
  taxonomy: {
    taxonomyVersionId: string;
    taxonomyVersion: string;
  };
  careerPaths: CareerFitAlgorithmExecutionPath[];
}

export interface CareerFitAlgorithmExecutionResult {
  careerPathId: string;
  score: string;
  evidenceData: Record<string, unknown>;
}

export interface CareerFitAlgorithmDefinition {
  key: string;
  version: string;
  rankOrder: CareerFitRankOrder;
  validateConfiguration?: (
    context: CareerFitAlgorithmValidationContext,
  ) => CareerFitAlgorithmValidationIssue[];
  execute: (input: CareerFitAlgorithmExecutionInput) => CareerFitAlgorithmExecutionResult[];
}

@Injectable()
export class CareerFitAlgorithmRegistry {
  private readonly definitions = new Map<string, CareerFitAlgorithmDefinition>();

  public constructor(
    @Inject(CAREER_FIT_ALGORITHM_DEFINITIONS)
    definitions: readonly CareerFitAlgorithmDefinition[],
  ) {
    for (const definition of definitions) {
      const registryKey = this.registryKey(definition.key, definition.version);

      if (this.definitions.has(registryKey)) {
        throw new Error(`Duplicate career-fit algorithm registration: ${registryKey}`);
      }

      this.definitions.set(registryKey, definition);
    }
  }

  public get(key: string, version: string): CareerFitAlgorithmDefinition | null {
    return this.definitions.get(this.registryKey(key, version)) ?? null;
  }

  public isRegistered(key: string, version: string): boolean {
    return this.get(key, version) !== null;
  }

  public listRegistered(): Array<{ key: string; version: string; rankOrder: CareerFitRankOrder }> {
    return [...this.definitions.values()]
      .map(({ key, version, rankOrder }) => ({ key, version, rankOrder }))
      .sort((left, right) =>
        `${left.key}@${left.version}`.localeCompare(`${right.key}@${right.version}`),
      );
  }

  private registryKey(key: string, version: string): string {
    return `${key.trim()}@${version.trim()}`;
  }
}
