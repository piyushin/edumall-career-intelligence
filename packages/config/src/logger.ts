import type { AppConfig, LogLevel } from "./env";

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface StructuredLogEntry extends LogContext {
  environment: string;
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
}

const sensitiveKeyPattern = /authorization|cookie|password|secret|token|assessment|response/i;

export class StructuredLogger {
  public constructor(private readonly config: Pick<AppConfig, "appEnv" | "serviceName">) {}

  public debug(message: string, context: LogContext = {}): void {
    this.write("debug", message, context);
  }

  public info(message: string, context: LogContext = {}): void {
    this.write("info", message, context);
  }

  public warn(message: string, context: LogContext = {}): void {
    this.write("warn", message, context);
  }

  public error(message: string, context: LogContext = {}): void {
    this.write("error", message, context);
  }

  private write(level: LogLevel, message: string, context: LogContext): void {
    const entry: StructuredLogEntry = {
      ...redactSensitiveFields(context),
      environment: this.config.appEnv,
      level,
      message,
      service: this.config.serviceName,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(entry);

    if (level === "error") {
      console.error(serialized);
      return;
    }

    if (level === "warn") {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }
}

export function redactSensitiveFields<T extends Record<string, unknown>>(value: T): T {
  return Object.entries(value).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
    if (sensitiveKeyPattern.test(key)) {
      accumulator[key] = "[REDACTED]";
      return accumulator;
    }

    if (isPlainObject(entry)) {
      accumulator[key] = redactSensitiveFields(entry);
      return accumulator;
    }

    accumulator[key] = entry;
    return accumulator;
  }, {}) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
