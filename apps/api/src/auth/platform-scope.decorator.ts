import { SetMetadata } from "@nestjs/common";
import { AUTH_PLATFORM_SCOPE_KEY } from "./auth.tokens";

export const PlatformScope = () => SetMetadata(AUTH_PLATFORM_SCOPE_KEY, true);
