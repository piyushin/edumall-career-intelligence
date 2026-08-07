import { UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hasUsablePasswordCredentials,
  verifyPassword,
  verifyUserPassword,
} from "./password";

describe("password security", () => {
  it("verifies a valid password and rejects an invalid password", async () => {
    const passwordHash = await hashPassword("A strong passphrase! 2026");

    await expect(verifyPassword(passwordHash, "A strong passphrase! 2026")).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, "not-the-password")).resolves.toBe(false);
  });

  it("salts hashes so the same password has non-identical hashes", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(first).toMatch(/^\$argon2id\$/);
    expect(second).toMatch(/^\$argon2id\$/);
    expect(first).not.toBe(second);
  });

  it("fails safely for malformed hashes", async () => {
    await expect(verifyPassword("not-an-argon2-hash", "password")).resolves.toBe(false);
  });

  it("requires an active user and an argon2id hash for usable credentials", () => {
    expect(
      hasUsablePasswordCredentials({
        status: UserStatus.ACTIVE,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$example$example",
      }),
    ).toBe(true);
    expect(hasUsablePasswordCredentials({ status: UserStatus.INVITED, passwordHash: null })).toBe(
      false,
    );
    expect(hasUsablePasswordCredentials({ status: UserStatus.ACTIVE, passwordHash: null })).toBe(
      false,
    );
  });

  it("never authenticates an invited user or an active user without a password hash", async () => {
    await expect(
      verifyUserPassword({ status: UserStatus.INVITED, passwordHash: null }, "password"),
    ).resolves.toBe(false);
    await expect(
      verifyUserPassword({ status: UserStatus.ACTIVE, passwordHash: null }, "password"),
    ).resolves.toBe(false);
  });
});
