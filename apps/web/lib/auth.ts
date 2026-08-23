import { apiRequest } from "./api";

export type MembershipRole =
  "SUPER_ADMIN" | "ORGANIZATION_ADMIN" | "COUNSELLOR" | "ASSESSOR" | "STUDENT" | "EMPLOYEE";

export type PublicSignupSegment =
  "SCHOOL_6_8" | "SCHOOL_9_10" | "SCHOOL_11_12" | "COLLEGE" | "PROFESSIONAL" | "SKILLED_WORKFORCE";

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
  return apiRequest<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export async function signup(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  segment: PublicSignupSegment;
}): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/signup", { method: "POST", body: JSON.stringify(input) });
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/auth/logout", { method: "POST" });
}
