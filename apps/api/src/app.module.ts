import { Module, type DynamicModule } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { AssessmentModule } from "./assessments/assessment.module";
import { AuthModule } from "./auth/auth.module";
import { CareerIntelligenceModule } from "./career-intelligence/career-intelligence.module";
import { APP_CONFIG } from "./config/app-config.token";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { ReadinessService } from "./health/readiness.service";

@Module({})
export class AppModule {
  public static register(config: AppConfig): DynamicModule {
    return {
      controllers: [HealthController],
      imports: [
        DatabaseModule.register(config),
        AuthModule.register(config),
        AssessmentModule,
        CareerIntelligenceModule,
      ],
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
