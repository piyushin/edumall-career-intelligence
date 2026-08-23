import { CommerceEntitlementStatus, CommerceEntitlementType, PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function isPublicSignup(metadata: Prisma.JsonValue | null): boolean {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return false;
  }

  return (metadata as Record<string, unknown>).registrationSource === "PUBLIC_SIGNUP";
}

async function main(): Promise<void> {
  const releases = await prisma.assessmentReportRelease.findMany({
    select: {
      releasedAt: true,
      attempt: {
        select: {
          id: true,
          assignment: {
            select: {
              organizationId: true,
              userId: true,
              metadata: true,
            },
          },
        },
      },
    },
  });

  let eligible = 0;
  let granted = 0;

  for (const release of releases) {
    const assignment = release.attempt.assignment;

    if (!isPublicSignup(assignment.metadata)) {
      continue;
    }

    eligible += 1;

    const existing = await prisma.commerceEntitlement.findUnique({
      where: {
        userId_attemptId_type: {
          userId: assignment.userId,
          attemptId: release.attempt.id,
          type: CommerceEntitlementType.REPORT,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      continue;
    }

    await prisma.commerceEntitlement.create({
      data: {
        organizationId: assignment.organizationId,
        userId: assignment.userId,
        attemptId: release.attempt.id,
        orderId: null,
        type: CommerceEntitlementType.REPORT,
        status: CommerceEntitlementStatus.ACTIVE,
        source: "PRE_R18_RELEASE",
        grantedAt: release.releasedAt,
        metadata: {
          reason:
            "Grandfathered because this public-signup report was already released before Release 18 commerce enforcement.",
        },
      },
    });

    granted += 1;
  }

  console.log(
    `Release 18 grandfather report entitlements: eligible=${eligible} granted=${granted}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
