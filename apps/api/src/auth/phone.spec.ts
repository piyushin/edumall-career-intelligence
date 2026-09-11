import { describe, expect, it } from "vitest";
import { isPhoneE164, normalizePhoneE164 } from "./phone";

describe("canonical E.164 phone", () => {
  it("normalizes common separators", () => {
    expect(normalizePhoneE164(" +91 (98765) 43210 ")).toBe("+919876543210");
  });

  it.each(["919876543210", "+0123456789", "+123", "+1234567890123456", "+1ABC5551234"])(
    "rejects %s",
    (value) => expect(isPhoneE164(value)).toBe(false),
  );
});
