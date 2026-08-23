import { loadConfig } from "@edumall/config";
import { hashPassword } from "@edumall/database";
import {
  MembershipRole,
  MembershipStatus,
  SessionScope,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

vi.mock("@edumall/database", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, hashPassword: vi.fn() };
});

const organizationId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";
const membershipId = "33333333-3333-4333-8333-333333333333";
const versionId = "55555555-5555-4555-8555-555555555555";
const sessionId = "44444444-4444-4444-8444-444444444444";

const config = loadConfig(
  {
    APP_ENV: "test",
    APP_VERSION: "test",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    NODE_ENV: "test",
    REDIS_URL: "redis://localhost:6379",
    PUBLIC_REGISTRATION_ENABLED: "true",
    PUBLIC_SIGNUP_ORGANIZATION_ID: organizationId,
  },
  { serviceName: "api" },
);

function createPrisma() {
  const tx = {
    organization: { findFirst: vi.fn().mockResolvedValue({ id: organizationId }) },
    assessmentVersion: { findFirst: vi.fn().mockResolvedValue({ id: versionId }) },
    user: {
      create: vi.fn().mockResolvedValue({
        email: "Candidate@Example.com",
        id: userId,
        status: UserStatus.ACTIVE,
      }),
    },
    organizationMembership: {
      create: vi.fn().mockResolvedValue({
        id: membershipId,
        organizationId,
        role: MembershipRole.STUDENT,
      }),
    },
    assessmentAssignment: { create: vi.fn().mockResolvedValue({ id: "assignment-id" }) },
  };

  return {
    tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    session: { create: vi.fn().mockResolvedValue({ id: sessionId }) },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
}

describe("AuthService public candidate signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hashPassword).mockResolvedValue("$argon2id$secure-hash");
  });

  it("creates a student membership, assigns the selected published battery and issues an organization session", async () => {
    const prisma = createPrisma();
    const service = new AuthService(prisma as unknown as PrismaClient, config);

    const result = await service.signup(
      {
        firstName: "Asha",
        lastName: "Patel",
        email: " Candidate@Example.com ",
        password: "very-secure-password",
        segment: "SCHOOL_9_10",
      },
      { ipAddress: "127.0.0.1", userAgent: "test" },
    );

    expect(hashPassword).toHaveBeenCalledWith("very-secure-password");
    expect(prisma.tx.assessmentVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessmentDefinition: expect.objectContaining({
            code: "EDUMALL_SCHOOL_9_10_CAREER_GUIDANCE",
          }),
        }),
      }),
    );
    expect(prisma.tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "Candidate@Example.com",
          normalizedEmail: "candidate@example.com",
          firstName: "Asha",
          lastName: "Patel",
          status: UserStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.tx.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        userId,
        role: MembershipRole.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true, organizationId: true, role: true },
    });
    expect(prisma.tx.assessmentAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          assessmentVersionId: versionId,
          userId,
          metadata: {
            registrationSource: "PUBLIC_SIGNUP",
            productSegment: "SCHOOL_9_10",
          },
        }),
      }),
    );
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        scope: SessionScope.ORGANIZATION,
        userId,
      }),
    });
    expect(result.context).toMatchObject({
      membershipId,
      organizationId,
      role: MembershipRole.STUDENT,
      sessionId,
      userId,
    });
  });
});
