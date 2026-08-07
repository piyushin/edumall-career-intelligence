import type { AuthContext } from "@edumall/database";
import type { User, UserStatus } from "@prisma/client";
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export type { AuthContext };

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
