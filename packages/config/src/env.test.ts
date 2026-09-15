import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "./env";

const validEnv = {
  APP_ENV: "test",
  APP_VERSION: "0.1.0-test",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001",
  DATABASE_URL: "postgresql://edumall:local@localhost:5432/edumall_test?schema=public",
  LOG_LEVEL: "info",
  NODE_ENV: "test",
  REDIS_URL: "redis://localhost:6379",
};

describe("loadConfig", () => {
  it("loads validated configuration", () => {
    const config = loadConfig(validEnv, { defaultPort: 3001, serviceName: "api" });

    expect(config.serviceName).toBe("api");
    expect(config.port).toBe(3001);
    expect(config.corsAllowedOrigins).toEqual(["http://localhost:3000", "http://localhost:3001"]);
  });

  it("defaults account lockout to 10 failures / 15 minutes and honors overrides", () => {
    const defaultConfig = loadConfig(validEnv, { serviceName: "api" });

    expect(defaultConfig.authLockoutThreshold).toBe(10);
    expect(defaultConfig.authLockoutDurationSeconds).toBe(900);

    const overriddenConfig = loadConfig(
      { ...validEnv, AUTH_LOCKOUT_THRESHOLD: "3", AUTH_LOCKOUT_DURATION_SECONDS: "60" },
      { serviceName: "api" },
    );

    expect(overriddenConfig.authLockoutThreshold).toBe(3);
    expect(overriddenConfig.authLockoutDurationSeconds).toBe(60);
  });

  it("rejects missing required variables", () => {
    const { DATABASE_URL: _databaseUrl, ...envWithoutDatabase } = validEnv;

    expect(() => loadConfig(envWithoutDatabase, { serviceName: "api" })).toThrow(
      ConfigValidationError,
    );
  });

  it("rejects wildcard CORS origins in production", () => {
    expect(() =>
      loadConfig(
        {
          ...validEnv,
          APP_ENV: "production",
          AUTH_CSRF_SECRET: "production-csrf-secret-with-at-least-32-characters",
          CORS_ALLOWED_ORIGINS: "*",
          NODE_ENV: "production",
        },
        { serviceName: "api" },
      ),
    ).toThrow(/wildcard/);
  });

  it("rejects the development CSRF secret when either environment is production", () => {
    expect(() =>
      loadConfig(
        {
          ...validEnv,
          APP_ENV: "production",
          NODE_ENV: "production",
        },
        { serviceName: "api" },
      ),
    ).toThrow(/AUTH_CSRF_SECRET/);
  });

  it("requires secure authentication cookies in production", () => {
    expect(() =>
      loadConfig(
        {
          ...validEnv,
          APP_ENV: "production",
          AUTH_COOKIE_SECURE: "false",
          AUTH_CSRF_SECRET: "production-csrf-secret-with-at-least-32-characters",
          NODE_ENV: "production",
        },
        { serviceName: "api" },
      ),
    ).toThrow(/AUTH_COOKIE_SECURE/);
  });
});
