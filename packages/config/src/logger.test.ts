import { describe, expect, it } from "vitest";
import { redactSensitiveFields } from "./logger";

describe("redactSensitiveFields", () => {
  it("redacts sensitive log fields", () => {
    const redacted = redactSensitiveFields({
      nested: {
        token: "secret",
      },
      password: "secret",
      safe: "value",
    });

    expect(redacted).toEqual({
      nested: {
        token: "[REDACTED]",
      },
      password: "[REDACTED]",
      safe: "value",
    });
  });
});
