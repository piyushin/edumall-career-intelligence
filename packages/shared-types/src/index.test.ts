import { describe, expect, it } from "vitest";
import type { HealthResponse } from "./index";

describe("shared technical API types", () => {
  it("supports a stable health response shape", () => {
    const response: HealthResponse = {
      environment: "test",
      service: "api",
      status: "ok",
      timestamp: "2026-07-30T00:00:00.000Z",
      version: "0.1.0-test",
    };

    expect(response.status).toBe("ok");
  });
});
