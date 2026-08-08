import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { createPrismaClient } from "@edumall/database";
import { APP_CONFIG } from "../config/app-config.token";

@Injectable()
export class DatabasePrismaProvider implements OnModuleDestroy {
  public readonly client: ReturnType<typeof createPrismaClient>;

  public constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = createPrismaClient(config.databaseUrl);
  }

  public async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
