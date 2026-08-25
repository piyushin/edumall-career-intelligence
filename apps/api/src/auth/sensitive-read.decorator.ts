import { SetMetadata } from "@nestjs/common";
import { AUTH_SENSITIVE_READ_KEY } from "./auth.tokens";

export const SensitiveRead = () => SetMetadata(AUTH_SENSITIVE_READ_KEY, true);
