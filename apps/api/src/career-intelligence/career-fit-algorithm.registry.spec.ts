import { describe, expect, it } from "vitest";
import { CareerFitAlgorithmRegistry } from "./career-fit-algorithm.registry";

const execute = () => [];

describe("CareerFitAlgorithmRegistry", () => {
  it("requires an exact key and version match", () => {
    const registry = new CareerFitAlgorithmRegistry([
      {
        key: "approved-fit",
        version: "1",
        rankOrder: "DESC",
        execute,
      },
    ]);

    expect(registry.isRegistered("approved-fit", "1")).toBe(true);
    expect(registry.isRegistered("approved-fit", "2")).toBe(false);
    expect(registry.isRegistered("other-fit", "1")).toBe(false);
  });

  it("rejects duplicate algorithm registrations", () => {
    expect(
      () =>
        new CareerFitAlgorithmRegistry([
          { key: "approved-fit", version: "1", rankOrder: "DESC", execute },
          { key: "approved-fit", version: "1", rankOrder: "DESC", execute },
        ]),
    ).toThrow("Duplicate career-fit algorithm registration");
  });
});
