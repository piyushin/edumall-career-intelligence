import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  ["assessment.view", "assessment", "view", "View assessments and assessment configuration."],
  ["assessment.manage", "assessment", "manage", "Create and edit assessments and assignments."],
  ["assessment.publish", "assessment", "publish", "Publish assessment content and versions."],

  ["career.view", "career", "view", "View career intelligence configuration."],
  ["career.manage", "career", "manage", "Manage career intelligence content."],
  ["career.mapping.manage", "career", "mapping", "Manage CareerFit and career/course mappings."],

  ["candidate.view", "candidate", "view", "View candidate records and assessment outcomes."],
  ["candidate.manage", "candidate", "manage", "Manage candidate operational records."],
  ["report.release", "report", "release", "Release assessment reports to candidates."],
  ["report.search", "report", "search", "Search report metadata within authorized scope."],
  [
    "report.view.full",
    "report",
    "view_full",
    "Open complete reports within authorized administrative scope.",
  ],
  [
    "report.download",
    "report",
    "download",
    "Download complete reports when report access policy permits.",
  ],
  [
    "report.credit.view",
    "report_credit",
    "view",
    "View report-credit wallets and immutable ledger entries.",
  ],
  ["report.credit.manage", "report_credit", "manage", "Allot, revoke, and consume report credits."],
  [
    "counsellor.assignment.view",
    "counsellor_assignment",
    "view",
    "View candidate-to-counsellor assignments.",
  ],
  [
    "counsellor.assignment.manage",
    "counsellor_assignment",
    "manage",
    "Create and revoke candidate-to-counsellor assignments.",
  ],

  ["counsellor.view", "counsellor", "view", "View counsellors and counselling operations."],
  ["counsellor.approve", "counsellor", "approve", "Approve or suspend counsellors."],
  [
    "counsellor.map",
    "counsellor",
    "mapping",
    "Map counsellors to assessments and specialisations.",
  ],
  ["appointment.manage", "counsellor", "appointment", "Manage counselling appointments."],

  ["commerce.view", "commerce", "view", "View products, orders, payments and entitlements."],
  ["commerce.product.manage", "commerce", "product", "Manage commerce products."],
  ["commerce.price.manage", "commerce", "pricing", "Manage commercial pricing."],
  ["commerce.coupon.manage", "commerce", "coupon", "Create and manage coupons."],
  ["commerce.payment.approve", "commerce", "payment", "Approve supported manual payments."],
  ["commerce.refund.manage", "commerce", "refund", "Manage permitted refunds."],

  ["organization.view", "organization", "view", "View institutions and partner organizations."],
  ["organization.onboard", "organization", "onboard", "Onboard institutions and partners."],
  ["organization.manage", "organization", "manage", "Manage institution and partner records."],

  ["admin.view", "administration", "view", "View delegated administrators."],
  ["admin.create", "administration", "create", "Create delegated administrators."],
  [
    "admin.permission.manage",
    "administration",
    "permission",
    "Assign and revoke administrative permissions.",
  ],
  [
    "admin.suspend",
    "administration",
    "suspend",
    "Suspend and reactivate delegated administrators.",
  ],

  ["audit.view", "audit", "view", "View privileged platform audit logs."],

  ["platform.settings.manage", "platform", "settings", "Manage platform-level configuration."],
] as const;

const templates = [
  {
    code: "ACADEMIC_CAREER_ADMIN",
    name: "Academic & Career Admin",
    description: "Assessment, CareerFit, career content, candidate results and report release.",
    permissions: [
      "assessment.view",
      "assessment.manage",
      "assessment.publish",
      "career.view",
      "career.manage",
      "career.mapping.manage",
      "candidate.view",
      "report.release",
      "report.search",
      "report.view.full",
      "report.download",
    ],
  },
  {
    code: "FINANCE_PARTNER_ADMIN",
    name: "Finance & Partner Admin",
    description: "Commerce, pricing, coupons, payments and institution/partner administration.",
    permissions: [
      "commerce.view",
      "commerce.product.manage",
      "commerce.price.manage",
      "commerce.coupon.manage",
      "commerce.payment.approve",
      "commerce.refund.manage",
      "report.credit.view",
      "report.credit.manage",
      "organization.view",
      "organization.onboard",
      "organization.manage",
    ],
  },
  {
    code: "COUNSELLING_ADMIN",
    name: "Counselling Admin",
    description: "Counsellor approval, mapping, candidate visibility and appointments.",
    permissions: [
      "counsellor.view",
      "counsellor.approve",
      "counsellor.map",
      "appointment.manage",
      "candidate.view",
      "report.release",
      "report.search",
      "report.view.full",
      "report.download",
      "counsellor.assignment.view",
      "counsellor.assignment.manage",
    ],
  },
  {
    code: "INSTITUTION_ADMIN",
    name: "Institution Admin",
    description: "Institution operations, candidates and assessment assignment workflows.",
    permissions: [
      "organization.view",
      "candidate.view",
      "candidate.manage",
      "assessment.view",
      "assessment.manage",
      "report.search",
      "report.credit.view",
      "report.credit.manage",
      "counsellor.assignment.view",
      "counsellor.assignment.manage",
    ],
  },
  {
    code: "AUDIT_COMPLIANCE_ADMIN",
    name: "Audit & Compliance Admin",
    description: "Read-only operational and privileged audit visibility.",
    permissions: [
      "audit.view",
      "organization.view",
      "candidate.view",
      "commerce.view",
      "assessment.view",
      "report.search",
      "report.credit.view",
    ],
  },
  {
    code: "ADMINISTRATION_ADMIN",
    name: "Administration Admin",
    description: "Delegated administration management without Super Admin wildcard access.",
    permissions: [
      "admin.view",
      "admin.create",
      "admin.permission.manage",
      "admin.suspend",
      "audit.view",
    ],
  },
] as const;

async function main() {
  for (const [code, module, action, description] of permissions) {
    await prisma.adminPermission.upsert({
      where: { code },
      create: { code, module, action, description },
      update: { module, action, description },
    });
  }

  for (const template of templates) {
    const roleTemplate = await prisma.adminRoleTemplate.upsert({
      where: { code: template.code },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        isSystem: true,
        isActive: true,
      },
      update: {
        name: template.name,
        description: template.description,
        isSystem: true,
        isActive: true,
      },
    });

    const permissionRows = await prisma.adminPermission.findMany({
      where: {
        code: {
          in: [...template.permissions],
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (permissionRows.length !== template.permissions.length) {
      throw new Error(`Permission seed incomplete for ${template.code}`);
    }

    await prisma.adminRoleTemplatePermission.deleteMany({
      where: {
        roleTemplateId: roleTemplate.id,
      },
    });

    await prisma.adminRoleTemplatePermission.createMany({
      data: permissionRows.map((permission) => ({
        permissionId: permission.id,
        roleTemplateId: roleTemplate.id,
      })),
    });
  }

  console.log(
    `R19 admin authorization seed: permissions=${permissions.length} templates=${templates.length}`,
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
