import { argon2id, hash, verify } from "argon2";
import { UserStatus, type User } from "@prisma/client";

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function hasUsablePasswordCredentials(
  user: Pick<User, "passwordHash" | "status">,
): user is Pick<User, "passwordHash" | "status"> & { passwordHash: string } {
  return (
    user.status === UserStatus.ACTIVE &&
    typeof user.passwordHash === "string" &&
    user.passwordHash.startsWith("$argon2id$")
  );
}

export async function verifyUserPassword(
  user: Pick<User, "passwordHash" | "status">,
  password: string,
): Promise<boolean> {
  return hasUsablePasswordCredentials(user) ? verifyPassword(user.passwordHash, password) : false;
}
