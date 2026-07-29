import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { RequestContext } from "@edumall/shared-types";

export interface RequestWithContext extends Request {
  context?: RequestContext;
}

export function requestContextMiddleware(
  request: RequestWithContext,
  response: Response,
  next: NextFunction,
): void {
  const requestId = readHeader(request, "x-request-id") ?? randomUUID();
  const correlationId = readHeader(request, "x-correlation-id") ?? requestId;

  request.context = {
    correlationId,
    requestId,
  };

  response.setHeader("x-request-id", requestId);
  response.setHeader("x-correlation-id", correlationId);

  next();
}

function readHeader(request: Request, name: string): string | undefined {
  const value = request.header(name);

  if (!value) {
    return undefined;
  }

  return value.trim() || undefined;
}
