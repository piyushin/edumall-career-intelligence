import { Logger, NotFoundException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StandardExceptionFilter } from "./standard-exception.filter";

function createHost(overrides: Partial<{ method: string; originalUrl: string }> = {}) {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const request = {
    method: overrides.method ?? "POST",
    originalUrl: overrides.originalUrl ?? "/admin/assessments",
    context: { correlationId: "corr-1", requestId: "req-1" },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, response, request };
}

describe("StandardExceptionFilter", () => {
  let config: AppConfig;

  beforeEach(() => {
    config = { isProduction: false } as AppConfig;
  });

  it("logs full detail server-side for an unexpected (5xx) error", () => {
    const filter = new StandardExceptionFilter(config);
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { host, response } = createHost();
    const exception = new Error("database exploded");

    filter.catch(exception, host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message, stack] = errorSpy.mock.calls[0] ?? [];
    expect(String(message)).toContain("database exploded");
    expect(String(message)).toContain("POST /admin/assessments");
    expect(stack).toBe(exception.stack);

    // The client-facing body must never leak the underlying error detail.
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ statusCode: 500 }),
      }),
    );
    expect(JSON.stringify(response.json.mock.calls[0]?.[0])).not.toContain("database exploded");

    errorSpy.mockRestore();
  });

  it("does not log a routine 4xx as an unexpected error", () => {
    const filter = new StandardExceptionFilter(config);
    const errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { host, response } = createHost();

    filter.catch(new NotFoundException({ code: "NOT_FOUND", message: "not found" }), host);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);

    errorSpy.mockRestore();
  });
});
