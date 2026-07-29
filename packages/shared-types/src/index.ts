export type ServiceStatus = "ok" | "ready" | "not_ready" | "error";

export interface RequestContext {
  requestId: string;
  correlationId: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  environment: string;
  version: string;
  timestamp: string;
  requestId?: string;
  correlationId?: string;
}

export interface ReadinessCheck {
  name: "database" | "redis";
  status: "ok" | "error";
  latencyMs: number;
  message?: string;
}

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  service: string;
  environment: string;
  version: string;
  timestamp: string;
  checks: ReadinessCheck[];
}

export interface StandardErrorBody {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    requestId?: string;
    correlationId?: string;
    details?: unknown;
  };
}
