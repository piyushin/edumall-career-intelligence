import { spawnSync } from "node:child_process";

if (process.env.RUN_DATABASE_INTEGRATION_TESTS !== "true") {
  console.log("Database integration tests skipped; set RUN_DATABASE_INTEGRATION_TESTS=true.");
} else {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to run database integration tests in production mode.");
  }

  const databaseUrl = process.env.DATABASE_INTEGRATION_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_INTEGRATION_URL is required.");
  }

  const parsedUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("DATABASE_INTEGRATION_URL must use PostgreSQL.");
  }

  if (!/(test|integration)/i.test(databaseName)) {
    throw new Error(
      "Refusing to migrate a database whose name does not contain 'test' or 'integration'.",
    );
  }

  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    RUN_DATABASE_INTEGRATION_TESTS: "true",
  };
  const migration = spawnSync(
    "pnpm",
    ["exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
    { env: environment, stdio: "inherit" },
  );

  if (migration.status !== 0) {
    throw new Error("Database integration migration failed.");
  }

  const tests = spawnSync("pnpm", ["exec", "vitest", "run", "src/integration.test.ts"], {
    env: environment,
    stdio: "inherit",
  });

  if (tests.status !== 0) {
    throw new Error("Database integration tests failed.");
  }
}
