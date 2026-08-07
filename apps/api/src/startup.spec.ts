import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "@edumall/config";

describe("startup configuration", () => {
  it("fails fast when required variables are missing", () => {
    expect(() =>
      loadConfig(
        {
          APP_ENV: "test",
          APP_VERSION: "0.1.0-test",
          CORS_ALLOWED_ORIGINS: "http://localhost:3000",
          NODE_ENV: "test",
          REDIS_URL: "redis://localhost:6379",
        },
        {
          serviceName: "api",
        },
      ),
    ).toThrow(ConfigValidationError);
  });
});
