import { z } from "zod";

export type AppEnvironment = "local" | "test" | "staging" | "production";
export type NodeEnvironment = "development" | "test" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppConfig {
  appEnv: AppEnvironment;
  corsAllowedOrigins: string[];
  databaseUrl: string;
  isProduction: boolean;
  logLevel: LogLevel;
  nodeEnv: NodeEnvironment;
  port: number;
  redisUrl: string;
  serviceName: string;
  version: string;
}

export interface LoadConfigOptions {
  defaultPort?: number;
  serviceName: string;
}

export class ConfigValidationError extends Error {
  public readonly issues: string[];

  public constructor(issues: string[]) {
    super(`Invalid environment configuration: ${issues.join("; ")}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

const rawEnvSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
    APP_VERSION: z.string().min(1).default("0.1.0-local"),
    CORS_ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().optional(),
    REDIS_URL: z.string().url(),
    SERVICE_NAME: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    const origins = parseCorsOrigins(value.CORS_ALLOWED_ORIGINS);

    if (value.APP_ENV === "production" && origins.includes("*")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CORS_ALLOWED_ORIGINS must not include wildcard origins in production",
        path: ["CORS_ALLOWED_ORIGINS"],
      });
    }
  });

export function loadConfig(source: NodeJS.ProcessEnv, options: LoadConfigOptions): AppConfig {
  const parsed = rawEnvSchema.safeParse({
    ...source,
    SERVICE_NAME: source.SERVICE_NAME ?? options.serviceName,
    PORT: source.PORT ?? options.defaultPort,
  });

  if (!parsed.success) {
    throw new ConfigValidationError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      }),
    );
  }

  const value = parsed.data;

  return {
    appEnv: value.APP_ENV,
    corsAllowedOrigins: parseCorsOrigins(value.CORS_ALLOWED_ORIGINS),
    databaseUrl: value.DATABASE_URL,
    isProduction: value.APP_ENV === "production" || value.NODE_ENV === "production",
    logLevel: value.LOG_LEVEL,
    nodeEnv: value.NODE_ENV,
    port: value.PORT ?? options.defaultPort ?? 3000,
    redisUrl: value.REDIS_URL,
    serviceName: value.SERVICE_NAME ?? options.serviceName,
    version: value.APP_VERSION,
  };
}

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
