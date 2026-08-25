import { MembershipRole } from "@prisma/client";
import type { AuthContext } from "./auth.types";

export function isPlatformAdministrator(context: AuthContext): boolean {
  return (
    context.organizationId === null &&
    (context.role === MembershipRole.SUPER_ADMIN || context.role === MembershipRole.PLATFORM_ADMIN)
  );
}
