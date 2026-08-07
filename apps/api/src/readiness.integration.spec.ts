import { loadConfig } from "@edumall/config";
import { describe, expect, it } from "vitest";
import { ReadinessService } from "./health/readiness.service";

const maybeDescribe = process.env.RUN_INTEGRATION_TESTS === "1" ? describe : describe.skip;

maybeDescribe("readiness integration checks", () => {
  it("checks real PostgreSQL and Redis services when enabled", async () => {
    const config = loadConfig(process.env, {
      defaultPort: 3001,
      serviceName: "api",
    });
    const service = new ReadinessService(config);

    const readiness = await service.check();
    await service.onModuleDestroy();

    expect(readiness.checks.map((check) => check.name)).toEqual(["database", "redis"]);
  });
});
