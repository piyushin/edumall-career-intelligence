import { type DynamicModule, Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AppConfig } from "@edumall/config";
import { APP_CONFIG } from "../config/app-config.token";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthPrismaProvider } from "./auth-prisma.provider";
import { AuthService } from "./auth.service";
import { AUTH_PRISMA } from "./auth.tokens";
import { CsrfGuard } from "./csrf.guard";
import { CsrfService } from "./csrf.service";
import { RolesGuard } from "./roles.guard";

@Module({})
export class AuthModule {
  public static register(config: AppConfig): DynamicModule {
    return {
      controllers: [AuthController],
      exports: [AuthGuard, AuthService, RolesGuard],
      imports: [
        ThrottlerModule.forRoot([
          {
            limit: config.authLoginRateLimit,
            ttl: config.authLoginRateWindowSeconds * 1000,
          },
        ]),
      ],
      module: AuthModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        AuthPrismaProvider,
        {
          inject: [AuthPrismaProvider],
          provide: AUTH_PRISMA,
          useFactory: (provider: AuthPrismaProvider) => provider.client,
        },
        AuthService,
        AuthGuard,
        CsrfGuard,
        CsrfService,
        RolesGuard,
      ],
    };
  }
}
