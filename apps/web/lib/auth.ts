import { apiRequest } from "./api";

export type MembershipRole =
  "SUPER_ADMIN" | "ORGANIZATION_ADMIN" | "COUNSELLOR" | "ASSESSOR" | "STUDENT" | "EMPLOYEE";

export interface AuthSession {
  session: {
    membershipId: string | null;
    organizationId: string | null;
    role: MembershipRole;
    userId: string;
    expiresAt?: string;
  };
  user: {
    id?: string;
    email?: string;
    name?: string | null;
    [key: string]: unknown;
  };
}

export async function getSession(): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/session");
}

export async function login(input: {
  email: string;
  password: string;
  organizationId?: string;
}): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/auth/logout", {
    method: "POST",
  });
}
