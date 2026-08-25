import { AuditOutcome, MembershipRole, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../auth/auth.types";
import { PlatformAdminGovernanceService } from "./platform-admin-governance.service";

const context: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  membershipId: "33333333-3333-4333-8333-333333333333",
  organizationId: null,
  role: MembershipRole.SUPER_ADMIN,
};

describe("PlatformAdminGovernanceService R19.1A", () => {
  it("creates a custom role with normalized permissions and mutation audit evidence", async () => {
    const templateId = "44444444-4444-4444-8444-444444444444";
    const tx = {
      adminPermission: {
        findMany: vi.fn().mockResolvedValue([
          { id: "55555555-5555-4555-8555-555555555555", code: "admin.view" },
          { id: "66666666-6666-4666-8666-666666666666", code: "audit.view" },
        ]),
      },
      adminRoleTemplate: {
        create: vi.fn().mockResolvedValue({
          id: templateId,
          code: "LAUNCH_OPERATOR",
          name: "Launch Operator",
          description: null,
          isSystem: false,
          isActive: true,
          createdAt: new Date("2026-08-25T10:00:00Z"),
        }),
      },
      adminRoleTemplatePermission: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as unknown as PrismaClient;

    const result = await new PlatformAdminGovernanceService(prisma).createRoleTemplate(context, {
      code: "LAUNCH_OPERATOR",
      name: "Launch Operator",
      permissionCodes: ["audit.view", "admin.view", "admin.view"],
    });

    expect(result).toMatchObject({
      id: templateId,
      isSystem: false,
      permissionCodes: ["admin.view", "audit.view"],
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "admin.role_template.created" }),
    });
  });

  it.each(["update", "replace", "activate", "deactivate"])(
    "protects system templates from %s",
    async (operation) => {
      const template = {
        id: "44444444-4444-4444-8444-444444444444",
        code: "ADMINISTRATION_ADMIN",
        name: "Administration Admin",
        description: null,
        isSystem: true,
        isActive: true,
        permissions: [],
      };
      const tx = { adminRoleTemplate: { findUnique: vi.fn().mockResolvedValue(template) } };
      const prisma = {
        adminRoleTemplate: { findUnique: vi.fn().mockResolvedValue(template) },
        $transaction: vi.fn(async (callback) => callback(tx)),
      } as unknown as PrismaClient;
      const service = new PlatformAdminGovernanceService(prisma);

      const promise =
        operation === "update"
          ? service.updateRoleTemplate(context, template.id, { name: "Unsafe rename" })
          : operation === "replace"
            ? service.replacePermissions(context, template.id, { permissionCodes: ["admin.view"] })
            : operation === "activate"
              ? service.activateRoleTemplate(context, template.id)
              : service.deactivateRoleTemplate(context, template.id);

      await expect(promise).rejects.toMatchObject({
        response: expect.objectContaining({ code: "SYSTEM_ROLE_TEMPLATE_PROTECTED" }),
      });
    },
  );

  it("denies delegated administrators from granting permissions they do not hold", async () => {
    const delegated = {
      ...context,
      role: MembershipRole.PLATFORM_ADMIN,
      permissions: ["admin.permission.manage", "admin.view"],
    };
    const prisma = {} as PrismaClient;

    await expect(
      new PlatformAdminGovernanceService(prisma).createRoleTemplate(delegated, {
        code: "ESCALATION_ATTEMPT",
        name: "Escalation attempt",
        permissionCodes: ["platform.settings.manage"],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ADMIN_PERMISSION_ESCALATION_DENIED" }),
    });
  });

  it("returns deterministic cursor pagination and persists sensitive-read evidence", async () => {
    const rows = [
      { id: "55555555-5555-4555-8555-555555555555", createdAt: new Date("2026-08-25T10:00:00Z") },
      { id: "44444444-4444-4444-8444-444444444444", createdAt: new Date("2026-08-25T09:00:00Z") },
    ];
    const create = vi.fn().mockResolvedValue({ id: "audit" });
    const findMany = vi.fn().mockResolvedValue(rows);
    const prisma = { auditLog: { create, findMany } } as unknown as PrismaClient;
    const service = new PlatformAdminGovernanceService(prisma);

    const result = await service.listAuditLogs(
      context,
      { limit: "1", outcome: AuditOutcome.SUCCEEDED, purpose: "security review" },
      { requestId: "req-1", correlationId: "corr-1" },
    );

    expect(result.items).toEqual([rows[0]]);
    expect(result.pageInfo.hasNext).toBe(true);
    expect(result.pageInfo.nextCursor).toEqual(expect.any(String));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );
    expect(JSON.stringify(findMany.mock.calls[0]?.[0]?.select)).not.toContain("metadata");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.audit.searched",
        requestId: "req-1",
        correlationId: "corr-1",
      }),
    });
  });

  it("fails closed only when mandatory privileged read evidence cannot persist", async () => {
    const prisma = {
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockRejectedValue(new Error("audit unavailable")),
      },
    } as unknown as PrismaClient;
    await expect(
      new PlatformAdminGovernanceService(prisma).listAuditLogs(context, {}),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MANDATORY_AUDIT_UNAVAILABLE" }),
    });
  });

  it("rejects an inverted audit date range before querying", async () => {
    const findMany = vi.fn();
    const service = new PlatformAdminGovernanceService({
      auditLog: { findMany },
    } as unknown as PrismaClient);
    await expect(
      service.listAuditLogs(context, {
        from: "2026-08-26T00:00:00.000Z",
        to: "2026-08-25T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INVALID_AUDIT_DATE_RANGE" }),
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
