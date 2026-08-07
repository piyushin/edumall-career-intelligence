import "dotenv/config";
import { QueueEvents } from "bullmq";
import Redis from "ioredis";
import { loadConfig, StructuredLogger } from "@edumall/config";

const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env, {
    defaultPort: 3002,
    serviceName: "worker",
  });
  const logger = new StructuredLogger(config);
  const connection = new Redis(config.redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: () => null,
  });
  connection.on("error", () => undefined);
  const queueEvents = new QueueEvents("phase-0-health", {
    connection,
  });

  await connection.connect();
  await connection.ping();
  await queueEvents.waitUntilReady();

  logger.info("worker.ready", {
    queue: "phase-0-health",
  });

  const heartbeat = setInterval(() => {
    logger.info("worker.health", {
      status: "ok",
    });
  }, WORKER_HEARTBEAT_INTERVAL_MS);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info("worker.shutdown.started", { signal });
    clearInterval(heartbeat);
    await queueEvents.close();
    connection.disconnect();
    logger.info("worker.shutdown.completed", { signal });
    process.exit(0);
  };

  process.on("SIGINT", (signal) => {
    void shutdown(signal);
  });
  process.on("SIGTERM", (signal) => {
    void shutdown(signal);
  });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker startup failure";

  console.error(
    JSON.stringify({
      environment: process.env.APP_ENV ?? "unknown",
      level: "error",
      message,
      service: "worker",
      timestamp: new Date().toISOString(),
    }),
  );
  process.exit(1);
});
