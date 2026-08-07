export enum AuthenticationErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  INVALID_SESSION = "INVALID_SESSION",
  EXPIRED_SESSION = "EXPIRED_SESSION",
  INACTIVE_USER = "INACTIVE_USER",
  INACTIVE_ORGANIZATION = "INACTIVE_ORGANIZATION",
  INACTIVE_MEMBERSHIP = "INACTIVE_MEMBERSHIP",
  FORBIDDEN_ORGANIZATION_ACCESS = "FORBIDDEN_ORGANIZATION_ACCESS",
  INVALID_INVITATION = "INVALID_INVITATION",
  EXPIRED_INVITATION_TOKEN = "EXPIRED_INVITATION_TOKEN",
  CONSUMED_INVITATION_TOKEN = "CONSUMED_INVITATION_TOKEN",
  INVALID_RESET_TOKEN = "INVALID_RESET_TOKEN",
  EXPIRED_RESET_TOKEN = "EXPIRED_RESET_TOKEN",
  CONSUMED_RESET_TOKEN = "CONSUMED_RESET_TOKEN",
  AUTHENTICATION_SERVICE_ERROR = "AUTHENTICATION_SERVICE_ERROR",
}

const publicMessages: Record<AuthenticationErrorCode, string> = {
  [AuthenticationErrorCode.INVALID_CREDENTIALS]: "Invalid credentials.",
  [AuthenticationErrorCode.INVALID_SESSION]: "Invalid session.",
  [AuthenticationErrorCode.EXPIRED_SESSION]: "Session has expired.",
  [AuthenticationErrorCode.INACTIVE_USER]: "Account is not active.",
  [AuthenticationErrorCode.INACTIVE_ORGANIZATION]: "Organization is not active.",
  [AuthenticationErrorCode.INACTIVE_MEMBERSHIP]: "Organization membership is not active.",
  [AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS]: "Organization access is forbidden.",
  [AuthenticationErrorCode.INVALID_INVITATION]: "Invitation is invalid.",
  [AuthenticationErrorCode.EXPIRED_INVITATION_TOKEN]: "Invitation has expired.",
  [AuthenticationErrorCode.CONSUMED_INVITATION_TOKEN]: "Invitation has already been used.",
  [AuthenticationErrorCode.INVALID_RESET_TOKEN]: "Password reset request is invalid.",
  [AuthenticationErrorCode.EXPIRED_RESET_TOKEN]: "Password reset request has expired.",
  [AuthenticationErrorCode.CONSUMED_RESET_TOKEN]: "Password reset request has already been used.",
  [AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR]:
    "Authentication is temporarily unavailable.",
};

export class AuthenticationError extends Error {
  readonly code: AuthenticationErrorCode;

  constructor(code: AuthenticationErrorCode) {
    super(publicMessages[code]);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function asAuthenticationError(
  error: unknown,
  fallbackCode = AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR,
): AuthenticationError {
  return isAuthenticationError(error) ? error : new AuthenticationError(fallbackCode);
}
