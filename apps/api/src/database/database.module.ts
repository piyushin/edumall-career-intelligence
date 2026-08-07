import { Global, type DynamicModule, Module } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import { APP_CONFIG } from "../config/app-config.token";
import { DatabasePrismaProvider } from "./database-prisma.provider";
import { DATABASE_PRISMA } from "./database.tokens";

@Global()
@Module({})
export class DatabaseModule {
  public static register(config: AppConfig): DynamicModule {
    return {
      exports: [DATABASE_PRISMA],
      global: true,
      module: DatabaseModule,
      providers: [
        {
          provide: APP_CONFIG,
          useValue: config,
        },
        DatabasePrismaProvider,
        {
          inject: [DatabasePrismaProvider],
          provide: DATABASE_PRISMA,
          useFactory: (provider: DatabasePrismaProvider) => provider.client,
        },
      ],
    };
  }
}
