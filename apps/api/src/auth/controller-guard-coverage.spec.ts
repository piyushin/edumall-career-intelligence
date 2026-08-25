import { GUARDS_METADATA, INTERCEPTORS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { AssessmentAdminController } from "../assessments/assessment-admin.controller";
import { AssessmentAssignmentAdminController } from "../assessments/assessment-assignment-admin.controller";
import { AssessmentResultsController } from "../assessments/assessment-results.controller";
import { CareerIntelligenceAdminController } from "../career-intelligence/career-intelligence-admin.controller";
import { CommerceAdminController } from "../commerce/commerce-admin.controller";
import { PlatformAdminController } from "../platform-admin/platform-admin.controller";
import { PlatformAdminGovernanceController } from "../platform-admin/platform-admin-governance.controller";
import { AUTH_PERMISSIONS_KEY } from "./auth.tokens";
import { PermissionsGuard } from "./permissions.guard";
import { PrivilegedMutationAuditInterceptor } from "./privileged-mutation-audit.interceptor";

const controllers = [
  PlatformAdminController,
  PlatformAdminGovernanceController,
  AssessmentAdminController,
  AssessmentAssignmentAdminController,
  AssessmentResultsController,
  CareerIntelligenceAdminController,
  CommerceAdminController,
];

describe("privileged controller guard coverage", () => {
  it.each(controllers)("wires PermissionsGuard and permission metadata on %s", (controller) => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
    expect(guards).toContain(PermissionsGuard);
    const interceptors = (Reflect.getMetadata(INTERCEPTORS_METADATA, controller) ??
      []) as unknown[];
    expect(interceptors).toContain(PrivilegedMutationAuditInterceptor);

    const classPermissions = Reflect.getMetadata(AUTH_PERMISSIONS_KEY, controller) as
      string[] | undefined;
    const prototype = controller.prototype as unknown as Record<string, unknown>;
    const methods = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== "constructor" && typeof prototype[name] === "function",
    );

    for (const method of methods) {
      const methodPermissions = Reflect.getMetadata(
        AUTH_PERMISSIONS_KEY,
        prototype[method] as object,
      ) as string[] | undefined;
      expect(methodPermissions ?? classPermissions, `${controller.name}.${method}`).toBeTruthy();
    }
  });
});
