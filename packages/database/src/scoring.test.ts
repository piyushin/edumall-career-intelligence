import { describe, expect, it } from "vitest";
import { calculateConstructRawScores } from "./scoring.js";

describe("deterministic assessment raw scoring", () => {
  it("aggregates explicit keyed scores by construct", () => {
    const result = calculateConstructRawScores([
      {
        constructId: "aptitude-verbal",
        itemId: "item-1",
        score: "1",
      },
      {
        constructId: "aptitude-verbal",
        itemId: "item-2",
        score: "2.5",
      },
    ]);

    expect(result).toEqual([
      {
        constructId: "aptitude-verbal",
        rawScore: "3.50000000",
        answeredItemCount: 2,
        contributionCount: 2,
      },
    ]);
  });

  it("applies weights exactly without binary floating-point arithmetic", () => {
    const result = calculateConstructRawScores([
      {
        constructId: "interest-r",
        itemId: "item-1",
        score: "0.1",
        weight: "0.2",
      },
      {
        constructId: "interest-r",
        itemId: "item-2",
        score: "1.2345",
        weight: "2",
      },
    ]);

    expect(result[0]?.rawScore).toBe("2.48900000");
  });

  it("supports negative keyed contributions", () => {
    const result = calculateConstructRawScores([
      {
        constructId: "scale-a",
        itemId: "item-1",
        score: "-2",
        weight: "1.5",
      },
    ]);

    expect(result[0]?.rawScore).toBe("-3.00000000");
  });

  it("counts distinct answered items separately from contributions", () => {
    const result = calculateConstructRawScores([
      {
        constructId: "scale-a",
        itemId: "item-1",
        score: "1",
      },
      {
        constructId: "scale-a",
        itemId: "item-1",
        score: "2",
      },
    ]);

    expect(result[0]).toMatchObject({
      answeredItemCount: 1,
      contributionCount: 2,
    });
  });

  it("returns stable construct ordering", () => {
    const result = calculateConstructRawScores([
      {
        constructId: "z",
        itemId: "item-1",
        score: "1",
      },
      {
        constructId: "a",
        itemId: "item-2",
        score: "1",
      },
    ]);

    expect(result.map((score) => score.constructId)).toEqual(["a", "z"]);
  });

  it("rejects precision beyond four decimal places", () => {
    expect(() =>
      calculateConstructRawScores([
        {
          constructId: "scale-a",
          itemId: "item-1",
          score: "1.00001",
        },
      ]),
    ).toThrow("Invalid fixed-4 decimal");
  });
});
