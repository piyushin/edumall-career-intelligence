import { describe, expect, it } from "vitest";
import { PILOT_BATTERIES } from "./pilot-battery-catalog";
import {
  GOVERNED_PILOT_PACKAGES,
  PILOT_DEPLOYMENT_MODE,
  PILOT_SCIENTIFIC_STATUS,
} from "./pilot-governed-package";

describe("EduMall governed pilot packages", () => {
  it("builds exactly one governed package for each of the six validated batteries", () => {
    expect(GOVERNED_PILOT_PACKAGES).toHaveLength(6);
    expect(new Set(GOVERNED_PILOT_PACKAGES.map((entry) => entry.segment)).size).toBe(6);

    for (const battery of PILOT_BATTERIES) {
      const governed = GOVERNED_PILOT_PACKAGES.find((entry) => entry.segment === battery.segment);
      expect(governed).toBeDefined();
      if (!governed) continue;
      expect(governed.scientificStatus).toBe(PILOT_SCIENTIFIC_STATUS);
      expect(governed.deploymentMode).toBe(PILOT_DEPLOYMENT_MODE);
      expect(governed.assessment.items).toHaveLength(battery.items.length);
      expect(governed.assessment.constructs).toHaveLength(battery.constructs.length);
      expect(governed.career.paths).toHaveLength(battery.careerPaths.length);
    }
  });

  it("creates only non-normative response-reference tables with null percentiles and standardized scores", () => {
    for (const governed of GOVERNED_PILOT_PACKAGES) {
      expect(governed.responseReference.normSet.populationMetadata.populationNorm).toBe(false);
      expect(governed.responseReference.group.sampleSize).toBeNull();
      for (const table of governed.responseReference.tables) {
        expect(table.row.standardizedScore).toBeNull();
        expect(table.row.percentile).toBeNull();
        expect(table.row.metadata.normativeStatistic).toBe(false);
      }
    }
  });

  it("uses RAW_SCORE developmental interpretation rules and covers every construct with four bands", () => {
    for (const governed of GOVERNED_PILOT_PACKAGES) {
      for (const construct of governed.assessment.constructs) {
        const rules = governed.interpretation.rules.filter(
          (rule) => rule.constructCode === construct.code,
        );
        expect(rules).toHaveLength(4);
        expect(rules.every((rule) => rule.metric === "RAW_SCORE")).toBe(true);

        const theoreticalMinimum = Number(construct.metadata.theoreticalMinimum);
        const theoreticalMaximum = Number(construct.metadata.theoreticalMaximum);
        expect(Number(rules[0]?.lowerBound)).toBeCloseTo(theoreticalMinimum, 6);
        expect(Number(rules.at(-1)?.upperBound)).toBeCloseTo(theoreticalMaximum, 6);

        for (let index = 1; index < rules.length; index += 1) {
          const previous = rules[index - 1];
          const current = rules[index];
          if (!previous || !current) throw new Error("Missing interpretation rule");
          expect(Number(current.lowerBound)).toBeGreaterThan(Number(previous.upperBound));
        }
      }
    }
  });

  it("preserves explicit keyed scoring without double-applying reverse scoring", () => {
    for (const governed of GOVERNED_PILOT_PACKAGES) {
      expect(governed.assessment.version.scoringConfig.explicitOptionScoresOnly).toBe(true);
      expect(
        governed.assessment.version.scoringConfig.reverseWordingAlreadyKeyedInOptionScores,
      ).toBe(true);
      for (const item of governed.assessment.items) {
        expect(item.constructLink.reverseScored).toBe(false);
        expect(item.options.every((option) => Number.isFinite(option.score))).toBe(true);
      }
    }
  });

  it("configures every CareerFit factor with the exact theoretical raw-score range of its construct", () => {
    for (const governed of GOVERNED_PILOT_PACKAGES) {
      const constructs = new Map(
        governed.assessment.constructs.map((construct) => [construct.code, construct]),
      );
      const pathCodes = new Set(governed.career.paths.map((path) => path.code));
      const orderIndexes = new Set<number>();

      for (const factor of governed.career.factors) {
        expect(pathCodes.has(factor.pathCode)).toBe(true);
        const construct = constructs.get(factor.constructCode);
        expect(construct).toBeDefined();
        if (!construct) continue;
        expect(factor.configuration.minimum).toBe(construct.metadata.theoreticalMinimum);
        expect(factor.configuration.maximum).toBe(construct.metadata.theoreticalMaximum);
        expect(factor.configuration.normativePercentileUsed).toBe(false);
        expect(orderIndexes.has(factor.orderIndex)).toBe(false);
        orderIndexes.add(factor.orderIndex);
      }
    }
  });

  it("keeps career recommendation bands complete on the 0-100 response-based scale", () => {
    for (const governed of GOVERNED_PILOT_PACKAGES) {
      const bands = governed.career.recommendationBands;
      expect(bands).toHaveLength(4);
      expect(bands[0]?.lowerBound).toBe(0);
      expect(bands.at(-1)?.upperBound).toBe(100);
      for (const band of bands) {
        expect(band.outputData.normativePercentileUsed).toBe(false);
      }
    }
  });

  it("carries employment-only safeguards into professional and skilled-workforce delivery metadata", () => {
    for (const governed of GOVERNED_PILOT_PACKAGES) {
      const notice = governed.assessment.version.deliveryConfig.employmentDecisionNotice;
      if (governed.segment === "PROFESSIONAL" || governed.segment === "SKILLED_WORKFORCE") {
        expect(String(notice)).toContain("sole basis for recruitment");
        expect(governed.career.model.methodology.soleDecisionUseProhibited).toBe(true);
      } else {
        expect(notice).toBeNull();
        expect(governed.career.model.methodology.soleDecisionUseProhibited).toBe(false);
      }
    }
  });

  it("contains no claim that the pilot package is population normed or scientifically validated", () => {
    const serialized = JSON.stringify(GOVERNED_PILOT_PACKAGES).toLowerCase();
    expect(serialized).not.toContain('"populationnorm":true');
    expect(serialized).not.toContain('"normativepercentileused":true');
    expect(serialized).not.toContain("scientifically validated assessment");
  });
});
