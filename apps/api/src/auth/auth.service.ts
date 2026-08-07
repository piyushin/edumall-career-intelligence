import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import {
  AuthenticationError,
  AuthenticationErrorCode,
  acceptInvitation,
  consumePasswordResetToken,
  hashOpaqueToken,
  normalizeEmail,
  recordAuthenticationFailure,
  requireActiveOrganizationMembership,
  requirePlatformAuthorization,
  validateSessionToken,
  verifyPassword,
  verifyUserPassword,
} from "@edumall/database";
import { SessionScope, type PrismaClient, type User } from "@prisma/client";
import { APP_CONFIG } from "../config/app-config.token";
import { AUTH_PRISMA } from "./auth.tokens";
import type { AuthContext, AuthenticationUser, LoginResult, SafeUser } from "./auth.types";

interface RequestMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$+/gt+m237M6/Zx9njqukqQ$3EGFx3w9sjyQNN77kwTir+9ro55vGe5wstvlGLcDE+Q";

@Injectable()
export class AuthService {
  public constructor(
    @Inject(AUTH_PRISMA) private readonly prisma: PrismaClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  public async login(
    email: string,
    password: string,
    organizationId?: string,
    metadata: RequestMetadata = {},
  ): Promise<LoginResult> {
    const normalizedEmail = normalizeEmail(email);
    let user: AuthenticationUser | null;

    try {
      user = await this.prisma.user.findUnique({
        where: { normalizedEmail },
        select: {
          email: true,
          id: true,
          lockedUntil: true,
          passwordHash: true,
          status: true,
        },
      });
    } catch {
      throw new AuthenticationError(AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR);
    }

    const passwordMatches = user
      ? await verifyUserPassword(user, password)
      : await verifyPassword(DUMMY_PASSWORD_HASH, password);
    const isTemporarilyLocked =
      user?.lockedUntil !== null &&
      user?.lockedUntil !== undefined &&
      user.lockedUntil > new Date();

    if (!user || !passwordMatches || isTemporarilyLocked) {
      await this.recordFailure(user?.id, metadata.ipAddress);
      throw new AuthenticationError(AuthenticationErrorCode.INVALID_CREDENTIALS);
    }

    try {
      const context = organizationId
        ? await this.organizationContext(user.id, organizationId)
        : await this.platformContext(user.id);
      const scope = organizationId ? SessionScope.ORGANIZATION : SessionScope.PLATFORM;
      const session = await this.issueSession(context, scope, metadata);
      const authContext = { ...context, sessionId: session.sessionId };

      await this.recordSuccess(user.id, organizationId, metadata.ipAddress);

      return {
        context: authContext,
        expiresAt: session.expiresAt,
        rawToken: session.rawToken,
        user: this.safeUser(user),
      };
    } catch (error) {
      await this.recordFailure(user.id, metadata.ipAddress);

      if (
        error instanceof AuthenticationError &&
        error.code === AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR
      ) {
        throw error;
      }

      if (error instanceof AuthenticationError) {
        throw new AuthenticationError(AuthenticationErrorCode.INVALID_CREDENTIALS);
      }

      throw new AuthenticationError(AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR);
    }
  }

  public async validateSession(token: string): Promise<AuthContext> {
    return validateSessionToken(this.prisma, token);
  }

  public async getCurrentUser(context: AuthContext): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: context.userId },
        select: {
          email: true,
          id: true,
          status: true,
        },
      });

      if (!user) {
        throw new AuthenticationError(AuthenticationErrorCode.INVALID_SESSION);
      }

      return this.safeUser(user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError(AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR);
    }
  }

  public async logout(context: AuthContext): Promise<void> {
    try {
      await this.prisma.session.updateMany({
        where: {
          id: context.sessionId,
          userId: context.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } catch {
      throw new AuthenticationError(AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR);
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          action: "session.revoked",
          actorUserId: context.userId,
          entityId: context.sessionId,
          entityType: "Session",
        },
      });
    } catch {
      // Audit availability must not alter the logout response after revocation.
    }
  }

  public acceptInvitation(token: string, password: string, ipAddress?: string) {
    return acceptInvitation(
      this.prisma,
      token,
      password,
      ipAddress === undefined ? {} : { ipAddress },
    );
  }

  public confirmPasswordReset(token: string, password: string, ipAddress?: string) {
    return consumePasswordResetToken(
      this.prisma,
      token,
      password,
      ipAddress === undefined ? {} : { ipAddress },
    );
  }

  private async organizationContext(
    userId: string,
    organizationId: string,
  ): Promise<Omit<AuthContext, "sessionId">> {
    const authorization = await requireActiveOrganizationMembership(
      this.prisma,
      userId,
      organizationId,
    );

    return {
      membershipId: authorization.membership.id,
      organizationId: authorization.organization.id,
      role: authorization.role,
      userId,
    };
  }

  private async platformContext(userId: string): Promise<Omit<AuthContext, "sessionId">> {
    const authorization = await requirePlatformAuthorization(this.prisma, userId);

    return {
      membershipId: authorization.membership.id,
      organizationId: null,
      role: authorization.role,
      userId,
    };
  }

  private async issueSession(
    context: Omit<AuthContext, "sessionId">,
    scope: SessionScope,
    metadata: RequestMetadata,
  ): Promise<{ expiresAt: Date; rawToken: string; sessionId: string }> {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.authSessionTtlSeconds * 1000);
    const session = await this.prisma.session.create({
      data: {
        expiresAt,
        ipAddress: metadata.ipAddress ?? null,
        organizationId: scope === SessionScope.ORGANIZATION ? context.organizationId : null,
        scope,
        tokenHash: hashOpaqueToken(rawToken),
        userAgent: metadata.userAgent ?? null,
        userId: context.userId,
      },
    });

    return { expiresAt, rawToken, sessionId: session.id };
  }

  private async recordFailure(userId?: string, ipAddress?: string): Promise<void> {
    try {
      await recordAuthenticationFailure(
        this.prisma,
        AuthenticationErrorCode.INVALID_CREDENTIALS,
        userId,
        ipAddress,
      );
    } catch {
      // Audit availability must not alter the authentication response.
    }
  }

  private async recordSuccess(
    userId: string,
    organizationId?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginCount: 0, lastLoginAt: new Date() },
      });
    } catch {
      // Authentication has succeeded; activity metadata is best effort.
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          action: "authentication.succeeded",
          actorUserId: userId,
          entityType: "AuthenticationAttempt",
          ipAddress: ipAddress ?? null,
          organizationId: organizationId ?? null,
        },
      });
    } catch {
      // Audit availability must not alter the authentication response.
    }
  }

  private safeUser(user: Pick<User, "email" | "id" | "status">): SafeUser {
    return {
      email: user.email,
      status: user.status,
      userId: user.id,
    };
  }
}
