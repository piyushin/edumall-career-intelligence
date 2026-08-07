import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadConfig, StructuredLogger } from "@edumall/config";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../app.module";
import { configureApi } from "../bootstrap";
import { ReadinessService } from "./readiness.service";

const testConfig = loadConfig(
  {
    APP_ENV: "test",
    APP_VERSION: "0.1.0-test",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    DATABASE_URL: "postgresql://edumall:local@localhost:5432/edumall_test?schema=public",
    LOG_LEVEL: "info",
    NODE_ENV: "test",
    REDIS_URL: "redis://localhost:6379",
  },
  {
    defaultPort: 3001,
    serviceName: "api",
  },
);

describe("health endpoints", () => {
  let app: INestApplication;
  const readinessService = {
    check: vi.fn(),
  };

  beforeEach(async () => {
    readinessService.check.mockResolvedValue({
      checks: [
        { latencyMs: 1, name: "database", status: "ok" },
        { latencyMs: 1, name: "redis", status: "ok" },
      ],
      environment: "test",
      service: "api",
      status: "ready",
      timestamp: "2026-07-30T00:00:00.000Z",
      version: "0.1.0-test",
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(testConfig)],
    })
      .overrideProvider(ReadinessService)
      .useValue(readinessService)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app, testConfig, new StructuredLogger(testConfig));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it("returns API health", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "req-test")
      .expect(200);

    expect(response.body).toMatchObject({
      correlationId: "req-test",
      environment: "test",
      requestId: "req-test",
      service: "api",
      status: "ok",
      version: "0.1.0-test",
    });
  });

  it("returns readiness when dependencies are available", async () => {
    const response = await request(app.getHttpServer()).get("/ready").expect(200);

    expect(response.body.status).toBe("ready");
    expect(response.body.checks).toHaveLength(2);
  });

  it("returns standard readiness failure response", async () => {
    readinessService.check.mockResolvedValueOnce({
      checks: [
        { latencyMs: 1, message: "connection refused", name: "database", status: "error" },
        { latencyMs: 1, name: "redis", status: "ok" },
      ],
      environment: "test",
      service: "api",
      status: "not_ready",
      timestamp: "2026-07-30T00:00:00.000Z",
      version: "0.1.0-test",
    });

    const response = await request(app.getHttpServer()).get("/ready").expect(503);

    expect(response.body.error).toMatchObject({
      code: "SERVICE_NOT_READY",
      message: "Required services are not ready",
      statusCode: 503,
    });
  });

  it("propagates request and correlation IDs", async () => {
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("x-request-id", "req-123")
      .set("x-correlation-id", "corr-456")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("req-123");
    expect(response.headers["x-correlation-id"]).toBe("corr-456");
    expect(response.body.requestId).toBe("req-123");
    expect(response.body.correlationId).toBe("corr-456");
  });

  it("returns standard error responses without stack traces", async () => {
    const response = await request(app.getHttpServer())
      .get("/missing")
      .set("x-request-id", "req-error")
      .expect(404);

    expect(response.body.error).toMatchObject({
      code: "NOT_FOUND",
      path: "/missing",
      requestId: "req-error",
      statusCode: 404,
    });
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });
});
