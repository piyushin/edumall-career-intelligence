import { Module, type DynamicModule } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { APP_CONFIG } from "./config/app-config.token";
import { HealthController } from "./health/health.controller";
import { ReadinessService } from "./health/readiness.service";

@Module({})
export class AppModule {
  public static register(config: AppConfig): DynamicModule {
    return {
      controllers: [HealthController],
      module: AppModule,
      providers: [
        {
          provide: APP_CONFIG,
          useValue: config,
        },
        ReadinessService,
      ],
    };
  }
}
