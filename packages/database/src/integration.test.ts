import { randomUUID } from "node:crypto";
import {
  MembershipRole,
  MembershipStatus,
  OrganizationType,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptInvitation,
  AuthenticationErrorCode,
  checkDatabaseConnection,
  createPrismaClient,
  hashOpaqueToken,
  validateSessionToken,
} from "./index";

const runIntegrationTests = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
const integrationDatabaseUrl = process.env.DATABASE_INTEGRATION_URL;

describe.skipIf(!runIntegrationTests)("PostgreSQL authentication integration", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      throw new Error(
        "DATABASE_INTEGRATION_URL is required when RUN_DATABASE_INTEGRATION_TESTS=true",
      );
    }

    prisma = createPrismaClient(integrationDatabaseUrl);
    await checkDatabaseConnection(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("runs the Phase 1B schema and enforces live session membership state", async () => {
    const suffix = randomUUID();
    const rawToken = `integration-session-${suffix}`;
    const expiredRawToken = `expired-integration-session-${suffix}`;
    const invitationRawToken = `integration-invitation-${suffix}`;

    const columns = await prisma.$queryRaw<Array<{ is_nullable: string }>>`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password_hash'
    `;
    expect(columns).toEqual([{ is_nullable: "YES" }]);

    const invitationTable = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invitation_tokens'
    `;
    expect(invitationTable).toEqual([{ table_name: "invitation_tokens" }]);

    const organization = await prisma.organization.create({
      data: {
        name: `Phase 1B Integration ${suffix}`,
        slug: `phase-1b-${suffix}`,
        type: OrganizationType.SCHOOL,
      },
    });
    const invitedUser = await prisma.user.create({
      data: {
        email: `phase-1b-${suffix}@example.test`,
        normalizedEmail: `phase-1b-${suffix}@example.test`,
        passwordHash: null,
        firstName: "Integration",
        lastName: "User",
        status: UserStatus.INVITED,
      },
    });

    try {
      expect(invitedUser.passwordHash).toBeNull();

      await prisma.invitationToken.create({
        data: {
          userId: invitedUser.id,
          tokenHash: hashOpaqueToken(invitationRawToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await acceptInvitation(prisma, invitationRawToken, "Integration password 2026!");
      const membership = await prisma.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: invitedUser.id,
          role: MembershipRole.STUDENT,
          status: MembershipStatus.ACTIVE,
        },
      });
      const activeSession = await prisma.session.create({
        data: {
          organizationId: organization.id,
          userId: invitedUser.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(validateSessionToken(prisma, rawToken)).resolves.toEqual({
        userId: invitedUser.id,
        organizationId: organization.id,
        membershipId: membership.id,
        role: MembershipRole.STUDENT,
        sessionId: activeSession.id,
      });

      await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.SUSPENDED },
      });
      await expect(validateSessionToken(prisma, rawToken)).rejects.toMatchObject({
        code: AuthenticationErrorCode.INACTIVE_MEMBERSHIP,
      });

      await prisma.session.create({
        data: {
          organizationId: organization.id,
          userId: invitedUser.id,
          tokenHash: hashOpaqueToken(expiredRawToken),
          expiresAt: new Date(Date.now() - 1),
        },
      });
      await expect(validateSessionToken(prisma, expiredRawToken)).rejects.toMatchObject({
        code: AuthenticationErrorCode.EXPIRED_SESSION,
      });
    } finally {
      await prisma.session.deleteMany({ where: { userId: invitedUser.id } });
      await prisma.organizationMembership.deleteMany({
        where: { userId: invitedUser.id },
      });
      await prisma.auditLog.deleteMany({ where: { actorUserId: invitedUser.id } });
      await prisma.user.delete({ where: { id: invitedUser.id } });
      await prisma.organization.delete({ where: { id: organization.id } });
    }
  });
});
