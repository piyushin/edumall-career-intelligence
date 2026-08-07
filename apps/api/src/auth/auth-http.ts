import {
  BadRequestException,
  type HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthenticationError, AuthenticationErrorCode } from "@edumall/database";

type AuthenticationOperation = "invitation" | "login" | "password-reset" | "session";

export function authenticationHttpError(
  error: unknown,
  operation: AuthenticationOperation,
): HttpException {
  const code =
    error instanceof AuthenticationError
      ? error.code
      : AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR;

  if (code === AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR) {
    return new ServiceUnavailableException({
      code: "AUTHENTICATION_UNAVAILABLE",
      message: "Authentication is temporarily unavailable.",
    });
  }

  if (operation === "login") {
    return new UnauthorizedException({
      code: "INVALID_CREDENTIALS",
      message: "Invalid credentials.",
    });
  }

  if (operation === "session") {
    return new UnauthorizedException({
      code: "INVALID_SESSION",
      message: "Authentication session is invalid.",
    });
  }

  return new BadRequestException({
    code: operation === "invitation" ? "INVALID_INVITATION" : "INVALID_RESET_TOKEN",
    message: "The authentication request cannot be completed.",
  });
}
