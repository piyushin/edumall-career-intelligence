import { SetMetadata } from "@nestjs/common";
import { AUTH_PERMISSIONS_KEY } from "./auth.tokens";

export const Permissions = (...permissions: string[]) =>
  SetMetadata(AUTH_PERMISSIONS_KEY, permissions);
