import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  type Organization,
  type OrganizationMembership,
  type PrismaClient,
  type User,
  UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuthenticationErrorCode } from "./auth-errors";
import { requireActiveOrganizationMembership } from "./authorization";

const now = new Date("2026-08-07T00:00:00.000Z");
const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";

function user(overrides: Partial<User> = {}): User {
  return {
    id: userId,
    email: "user@example.com",
    normalizedEmail: "user@example.com",
    passwordHash: null,
    firstName: "Test",
    lastName: "User",
    status: UserStatus.ACTIVE,
    emailVerifiedAt: now,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: organizationId,
    name: "Test Organization",
    slug: "test-organization",
    status: OrganizationStatus.ACTIVE,
    type: OrganizationType.SCHOOL,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function membership(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId,
    userId,
    role: MembershipRole.STUDENT,
    status: MembershipStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function prismaMock(
  options: {
    user?: User | null;
    organization?: Organization | null;
    membership?: OrganizationMembership | null;
  } = {},
): PrismaClient {
  return {
    user: { findUnique: vi.fn().mockResolvedValue(options.user ?? user()) },
    organization: {
      findUnique: vi.fn().mockResolvedValue(options.organization ?? organization()),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue(options.membership ?? membership()),
    },
  } as unknown as PrismaClient;
}

describe("active organization membership enforcement", () => {
  it("allows an active user in an active organization with an active membership", async () => {
    await expect(
      requireActiveOrganizationMembership(prismaMock(), userId, organizationId),
    ).resolves.toMatchObject({
      user: { id: userId },
      organization: { id: organizationId },
      membership: { userId, organizationId },
      role: MembershipRole.STUDENT,
    });
  });

  it.each([UserStatus.INVITED, UserStatus.SUSPENDED, UserStatus.LOCKED, UserStatus.ARCHIVED])(
    "denies a %s user",
    async (status) => {
      await expect(
        requireActiveOrganizationMembership(
          prismaMock({ user: user({ status }) }),
          userId,
          organizationId,
        ),
      ).rejects.toMatchObject({ code: AuthenticationErrorCode.INACTIVE_USER });
    },
  );

  it("denies a suspended organization", async () => {
    await expect(
      requireActiveOrganizationMembership(
        prismaMock({ organization: organization({ status: OrganizationStatus.SUSPENDED }) }),
        userId,
        organizationId,
      ),
    ).rejects.toMatchObject({ code: AuthenticationErrorCode.INACTIVE_ORGANIZATION });
  });

  it.each([MembershipStatus.SUSPENDED, MembershipStatus.REVOKED])(
    "denies a %s membership",
    async (status) => {
      await expect(
        requireActiveOrganizationMembership(
          prismaMock({ membership: membership({ status }) }),
          userId,
          organizationId,
        ),
      ).rejects.toMatchObject({ code: AuthenticationErrorCode.INACTIVE_MEMBERSHIP });
    },
  );

  it("denies a missing membership", async () => {
    const prisma = prismaMock();
    vi.mocked(prisma.organizationMembership.findUnique).mockResolvedValue(null);

    await expect(
      requireActiveOrganizationMembership(prisma, userId, organizationId),
    ).rejects.toMatchObject({
      code: AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS,
    });
  });

  it("denies a membership lookup for the wrong organization", async () => {
    const prisma = prismaMock();
    vi.mocked(prisma.organizationMembership.findUnique).mockResolvedValue(null);
    const wrongOrganizationId = "44444444-4444-4444-8444-444444444444";

    await expect(
      requireActiveOrganizationMembership(prisma, userId, wrongOrganizationId),
    ).rejects.toMatchObject({
      code: AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS,
    });
    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId: wrongOrganizationId, userId },
      },
    });
  });
});
