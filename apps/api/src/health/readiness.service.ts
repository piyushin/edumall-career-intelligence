import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { checkDatabaseConnection, createPrismaClient } from "@edumall/database";
import type { ReadinessCheck, ReadinessResponse } from "@edumall/shared-types";
import Redis from "ioredis";
import { APP_CONFIG } from "../config/app-config.token";

@Injectable()
export class ReadinessService implements OnModuleDestroy {
  private readonly prisma: ReturnType<typeof createPrismaClient>;
  private readonly redis: Redis;

  public constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.prisma = createPrismaClient(config.databaseUrl);
    this.redis = new Redis(config.redisUrl, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.redis.on("error", () => undefined);
  }

  public async check(): Promise<ReadinessResponse> {
    const checks = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const ready = checks.every((check) => check.status === "ok");

    return {
      checks,
      environment: this.config.appEnv,
      service: this.config.serviceName,
      status: ready ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      version: this.config.version,
    };
  }

  public async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
    this.redis.disconnect();
  }

  private async checkDatabase(): Promise<ReadinessCheck> {
    const startedAt = performance.now();

    try {
      await checkDatabaseConnection(this.prisma);
      return {
        latencyMs: getElapsedMs(startedAt),
        name: "database",
        status: "ok",
      };
    } catch (error) {
      return {
        latencyMs: getElapsedMs(startedAt),
        message: getErrorMessage(error),
        name: "database",
        status: "error",
      };
    }
  }

  private async checkRedis(): Promise<ReadinessCheck> {
    const startedAt = performance.now();

    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }

      await this.redis.ping();
      return {
        latencyMs: getElapsedMs(startedAt),
        name: "redis",
        status: "ok",
      };
    } catch (error) {
      return {
        latencyMs: getElapsedMs(startedAt),
        message: getErrorMessage(error),
        name: "redis",
        status: "error",
      };
    }
  }
}

function getElapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown readiness error";
}
