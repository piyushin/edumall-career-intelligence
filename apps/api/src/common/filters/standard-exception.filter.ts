import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import type { StandardErrorBody } from "@edumall/shared-types";
import type { Request, Response } from "express";
import type { RequestWithContext } from "../middleware/request-context.middleware";

interface ExceptionResponse {
  code?: string;
  details?: unknown;
  error?: string;
  message?: string | string[];
}

@Catch()
export class StandardExceptionFilter implements ExceptionFilter {
  public constructor(private readonly config: AppConfig) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithContext & Request>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = getExceptionResponse(exception);
    const message = getSafeMessage(statusCode, exceptionResponse, this.config.isProduction);
    const code = exceptionResponse.code ?? getDefaultCode(statusCode);

    const errorBody: StandardErrorBody["error"] = {
      code,
      details: exceptionResponse.details,
      message,
      path: request.originalUrl,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    if (request.context?.correlationId) {
      errorBody.correlationId = request.context.correlationId;
    }

    if (request.context?.requestId) {
      errorBody.requestId = request.context.requestId;
    }

    const body: StandardErrorBody = {
      error: {
        ...errorBody,
      },
    };

    response.status(statusCode).json(body);
  }
}

function getExceptionResponse(exception: unknown): ExceptionResponse {
  if (!(exception instanceof HttpException)) {
    return {};
  }

  const response = exception.getResponse();

  if (typeof response === "string") {
    return {
      message: response,
    };
  }

  if (typeof response === "object" && response !== null) {
    return response as ExceptionResponse;
  }

  return {};
}

function getSafeMessage(
  statusCode: number,
  exceptionResponse: ExceptionResponse,
  isProduction: boolean,
): string {
  if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR && isProduction) {
    return "Internal server error";
  }

  const message = exceptionResponse.message;

  if (Array.isArray(message)) {
    return message.join("; ");
  }

  if (message) {
    return message;
  }

  return exceptionResponse.error ?? "Unexpected error";
}

function getDefaultCode(statusCode: number): string {
  if (statusCode === HttpStatus.NOT_FOUND) {
    return "NOT_FOUND";
  }

  if (statusCode === HttpStatus.SERVICE_UNAVAILABLE) {
    return "SERVICE_UNAVAILABLE";
  }

  if (statusCode >= 500) {
    return "INTERNAL_SERVER_ERROR";
  }

  return "REQUEST_ERROR";
}
