import { SetMetadata } from "@nestjs/common";
import type { MembershipRole } from "@prisma/client";
import { AUTH_ROLES_KEY } from "./auth.tokens";

export const Roles = (...roles: MembershipRole[]) => SetMetadata(AUTH_ROLES_KEY, roles);
