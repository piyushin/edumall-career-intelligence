import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadConfig, StructuredLogger } from "@edumall/config";
import { AppModule } from "./app.module";
import { configureApi } from "./bootstrap";

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env, {
    defaultPort: 3001,
    serviceName: "api",
  });
  const logger = new StructuredLogger(config);
  const app = await NestFactory.create(AppModule.register(config), {
    bufferLogs: true,
  });

  configureApi(app, config, logger);

  await app.listen(config.port);

  logger.info("api.started", {
    port: config.port,
  });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup failure";

  console.error(
    JSON.stringify({
      environment: process.env.APP_ENV ?? "unknown",
      level: "error",
      message,
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );
  process.exit(1);
});
