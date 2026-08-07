import { PrismaClient } from "@prisma/client";

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
