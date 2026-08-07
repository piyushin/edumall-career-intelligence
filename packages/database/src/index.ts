import {
  type AuditLog,
  type OrganizationMembership,
  type PasswordResetToken,
  type Prisma,
  PrismaClient,
  type Session,
} from "@prisma/client";
import { hashOpaqueToken } from "./tokens";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  if (!databaseUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

export async function checkDatabaseConnection(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export function findOrganizationMembership(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
): Promise<OrganizationMembership | null> {
  return prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });
}

export async function findActiveSessionByToken(
  prisma: PrismaClient,
  token: string,
): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

export async function findActivePasswordResetTokenByToken(
  prisma: PrismaClient,
  token: string,
): Promise<PasswordResetToken | null> {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return null;
  }

  return resetToken;
}

export type CreateAuditLogInput = Prisma.AuditLogUncheckedCreateInput;

export function createAuditLog(
  prisma: PrismaClient,
  input: CreateAuditLogInput,
): Promise<AuditLog> {
  return prisma.auditLog.create({ data: input });
}

export * from "./auth-errors";
export * from "./authorization";
export * from "./credential-lifecycle";
export * from "./password";
export * from "./sessions";
export { hashOpaqueToken } from "./tokens";
