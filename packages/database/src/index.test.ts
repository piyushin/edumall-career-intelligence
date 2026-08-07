import { describe, expect, it } from "vitest";
import { createPrismaClient } from "./index";

describe("database package", () => {
  it("creates a Prisma client without connecting during construction", () => {
    const client = createPrismaClient(
      "postgresql://edumall:local@localhost:5432/edumall_test?schema=public",
    );

    expect(client).toBeDefined();
    void client.$disconnect();
  });
});
