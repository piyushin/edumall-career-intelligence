import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import type { HealthResponse, ReadinessResponse } from "@edumall/shared-types";
import { APP_CONFIG } from "../config/app-config.token";
import { RequestContext } from "../common/request-context.decorator";
import { ReadinessService } from "./readiness.service";

@Controller()
export class HealthController {
  public constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(ReadinessService)
    private readonly readinessService: ReadinessService,
  ) {}

  @Get("health")
  public getHealth(
    @RequestContext("requestId") requestId?: string,
    @RequestContext("correlationId") correlationId?: string,
  ): HealthResponse {
    const response: HealthResponse = {
      environment: this.config.appEnv,
      service: this.config.serviceName,
      status: "ok",
      timestamp: new Date().toISOString(),
      version: this.config.version,
    };

    if (correlationId) {
      response.correlationId = correlationId;
    }

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  @Get("ready")
  public async getReady(): Promise<ReadinessResponse> {
    const readiness = await this.readinessService.check();

    if (readiness.status !== "ready") {
      throw new ServiceUnavailableException({
        code: "SERVICE_NOT_READY",
        details: {
          checks: readiness.checks,
        },
        message: "Required services are not ready",
      });
    }

    return readiness;
  }
}
