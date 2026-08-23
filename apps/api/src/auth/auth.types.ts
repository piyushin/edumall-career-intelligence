import type { AuthContext } from "@edumall/database";
import type { User, UserStatus } from "@prisma/client";
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export type { AuthContext };

export const PUBLIC_SIGNUP_SEGMENTS = [
  "SCHOOL_6_8",
  "SCHOOL_9_10",
  "SCHOOL_11_12",
  "COLLEGE",
  "PROFESSIONAL",
  "SKILLED_WORKFORCE",
] as const;

export type PublicSignupSegment = (typeof PUBLIC_SIGNUP_SEGMENTS)[number];

export interface RequestWithAuth {
  authContext?: AuthContext;
  cookies?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

export interface SafeUser {
  userId: string;
  email: string;
  status: UserStatus;
}

export interface LoginResult {
  context: AuthContext;
  user: SafeUser;
  rawToken: string;
  expiresAt: Date;
}

export type AuthenticationUser = Pick<
  User,
  "email" | "id" | "lockedUntil" | "passwordHash" | "status"
>;

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  public email!: string;

  @IsString()
  @MaxLength(1024)
  @MinLength(1)
  public password!: string;

  @IsOptional()
  @IsUUID()
  public organizationId?: string;
}

export class SignupDto {
  @IsString()
  @MaxLength(100)
  @MinLength(1)
  public firstName!: string;

  @IsString()
  @MaxLength(100)
  @MinLength(1)
  public lastName!: string;

  @IsEmail()
  @MaxLength(320)
  public email!: string;

  @IsString()
  @MaxLength(1024)
  @MinLength(12)
  public password!: string;

  @IsIn(PUBLIC_SIGNUP_SEGMENTS)
  public segment!: PublicSignupSegment;
}

export class CredentialDto {
  @IsString()
  @MaxLength(512)
  @MinLength(1)
  public token!: string;

  @IsString()
  @MaxLength(1024)
  @MinLength(12)
  public password!: string;
}
