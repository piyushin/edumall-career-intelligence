import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import type { AppConfig, StructuredLogger } from "@edumall/config";
import helmet from "helmet";
import { StandardExceptionFilter } from "./common/filters/standard-exception.filter";
import { requestContextMiddleware } from "./common/middleware/request-context.middleware";

export function configureApi(
  app: INestApplication,
  config: AppConfig,
  logger: StructuredLogger,
): void {
  app.use(helmet());
  app.use(requestContextMiddleware);

  app.enableCors({
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (config.corsAllowedOrigins.includes("*") || config.corsAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed"), false);
    },
  });

  app.useGlobalFilters(new StandardExceptionFilter(config));
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  logger.info("api.configured", {
    corsOrigins: config.corsAllowedOrigins,
    port: config.port,
  });
}
