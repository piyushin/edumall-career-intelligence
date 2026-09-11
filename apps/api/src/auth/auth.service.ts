import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AppConfig } from "@edumall/config";
import {
  AuthenticationError,
  AuthenticationErrorCode,
  acceptInvitation,
  consumePasswordResetToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  recordAuthenticationFailure,
  requireActiveOrganizationMembership,
  requirePlatformAuthorization,
  validateSessionToken,
  verifyPassword,
  verifyUserPassword,
} from "@edumall/database";
import {
  AssessmentDefinitionStatus,
  AssessmentVersionStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  Prisma,
  SessionScope,
  SessionPrivilegeType,
  UserStatus,
  type PrismaClient,
  type User,
} from "@prisma/client";
import { APP_CONFIG } from "../config/app-config.token";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  AuthContext,
  AuthenticationUser,
  LoginResult,
  PublicSignupSegment,
  SafeUser,
  SignupDto,
} from "./auth.types";
import { normalizePhoneE164 } from "./phone";

interface RequestMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$+/gt+m237M6/Zx9njqukqQ$3EGFx3w9sjyQNN77kwTir+9ro55vGe5wstvlGLcDE+Q";

const PUBLIC_ASSESSMENT_CODE_BY_SEGMENT: Record<PublicSignupSegment, string> = {
  SCHOOL_6_8: "EDUMALL_SCHOOL_6_8_CAREER_DISCOVERY",
  SCHOOL_9_10: "EDUMALL_SCHOOL_9_10_CAREER_GUIDANCE",
  SCHOOL_11_12: "EDUMALL_SCHOOL_11_12_CAREER_INTELLIGENCE",
  COLLEGE: "EDUMALL_COLLEGE_CAREER_INTELLIGENCE",
  PROFESSIONAL: "EDUMALL_PROFESSIONAL_CAREER_INTELLIGENCE",
  SKILLED_WORKFORCE: "EDUMALL_SKILLED_WORKFORCE_CAREER_INTELLIGENCE",
};

function publicSignupRole(segment: PublicSignupSegment): MembershipRole {
  return segment === "PROFESSIONAL" || segment === "SKILLED_WORKFORCE"
    ? MembershipRole.EMPLOYEE
    : MembershipRole.STUDENT;
}

@Injectable()
export class AuthService {
  public constructor(
    @Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient,
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
      const { context, scope } = await this.resolveLoginContext(user.id, organizationId);
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

  public async signup(input: SignupDto, metadata: RequestMetadata = {}): Promise<LoginResult> {
    const organizationId = this.config.publicSignupOrganizationId;

    if (!this.config.publicRegistrationEnabled || !organizationId) {
      throw new ForbiddenException({
        code: "PUBLIC_REGISTRATION_DISABLED",
        message: "Public registration is not currently available.",
      });
    }

    const email = input.email.trim();
    const normalizedEmail = normalizeEmail(email);
    let phoneE164: string;
    try {
      phoneE164 = normalizePhoneE164(input.mobile);
    } catch {
      throw new BadRequestException({
        code: "INVALID_MOBILE_NUMBER",
        message: "Enter a valid mobile number with international country code.",
      });
    }
    const assessmentCode = PUBLIC_ASSESSMENT_CODE_BY_SEGMENT[input.segment];

    try {
      const passwordHash = await hashPassword(input.password);
      const registration = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.findFirst({
          where: {
            id: organizationId,
            status: OrganizationStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!organization) {
          throw new ServiceUnavailableException({
            code: "PUBLIC_REGISTRATION_UNAVAILABLE",
            message: "Registration is temporarily unavailable. Please try again later.",
          });
        }

        const assessmentVersion = await tx.assessmentVersion.findFirst({
          where: {
            status: AssessmentVersionStatus.PUBLISHED,
            assessmentDefinition: {
              code: assessmentCode,
              status: AssessmentDefinitionStatus.ACTIVE,
            },
          },
          orderBy: { versionNumber: "desc" },
          select: { id: true },
        });

        if (!assessmentVersion) {
          throw new ServiceUnavailableException({
            code: "PUBLIC_ASSESSMENT_UNAVAILABLE",
            message: "The selected assessment is temporarily unavailable. Please try again later.",
          });
        }

        const user = await tx.user.create({
          data: {
            email,
            normalizedEmail,
            phoneE164,
            passwordHash,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            status: UserStatus.ACTIVE,
          },
          select: {
            email: true,
            id: true,
            status: true,
          },
        });

        const membership = await tx.organizationMembership.create({
          data: {
            organizationId,
            userId: user.id,
            role: publicSignupRole(input.segment),
            status: MembershipStatus.ACTIVE,
          },
          select: {
            id: true,
            organizationId: true,
            role: true,
          },
        });

        await tx.assessmentAssignment.create({
          data: {
            organizationId,
            assessmentVersionId: assessmentVersion.id,
            userId: user.id,
            assignedByUserId: null,
            maxAttempts: 1,
            metadata: {
              registrationSource: "PUBLIC_SIGNUP",
              productSegment: input.segment,
            },
          },
        });

        return { membership, user };
      });

      const context: Omit<AuthContext, "sessionId"> = {
        membershipId: registration.membership.id,
        organizationId: registration.membership.organizationId,
        role: registration.membership.role,
        userId: registration.user.id,
      };
      const session = await this.issueSession(context, SessionScope.ORGANIZATION, metadata);
      const authContext = { ...context, sessionId: session.sessionId };
      await this.recordSuccess(registration.user.id, organizationId, metadata.ipAddress);

      return {
        context: authContext,
        expiresAt: session.expiresAt,
        rawToken: session.rawToken,
        user: this.safeUser(registration.user),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException({
          code: "ACCOUNT_ALREADY_EXISTS",
          message: "An account with this email already exists. Please log in instead.",
        });
      }

      throw new ServiceUnavailableException({
        code: "PUBLIC_REGISTRATION_UNAVAILABLE",
        message: "Registration is temporarily unavailable. Please try again later.",
      });
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

  private async resolveLoginContext(
    userId: string,
    organizationId?: string,
  ): Promise<{
    context: Omit<AuthContext, "sessionId">;
    scope: SessionScope;
  }> {
    if (organizationId) {
      return {
        context: await this.organizationContext(userId, organizationId),
        scope: SessionScope.ORGANIZATION,
      };
    }

    try {
      return {
        context: await this.platformContext(userId),
        scope: SessionScope.PLATFORM,
      };
    } catch (error) {
      if (
        !(error instanceof AuthenticationError) ||
        error.code !== AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS
      ) {
        throw error;
      }
    }

    let memberships: { organizationId: string }[];
    try {
      memberships = await this.prisma.organizationMembership.findMany({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
          organization: { status: OrganizationStatus.ACTIVE },
        },
        select: { organizationId: true },
        take: 2,
      });
    } catch {
      throw new AuthenticationError(AuthenticationErrorCode.AUTHENTICATION_SERVICE_ERROR);
    }

    if (memberships.length !== 1) {
      throw new AuthenticationError(AuthenticationErrorCode.FORBIDDEN_ORGANIZATION_ACCESS);
    }

    return {
      context: await this.organizationContext(userId, memberships[0]!.organizationId),
      scope: SessionScope.ORGANIZATION,
    };
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
      adminProfileId: authorization.adminProfileId,
      privilegeType:
        authorization.role === MembershipRole.SUPER_ADMIN
          ? SessionPrivilegeType.SUPER_ADMIN
          : authorization.role === MembershipRole.PLATFORM_ADMIN
            ? SessionPrivilegeType.DELEGATED_ADMIN
            : SessionPrivilegeType.STANDARD,
    };
  }

  private async platformContext(userId: string): Promise<Omit<AuthContext, "sessionId">> {
    const authorization = await requirePlatformAuthorization(this.prisma, userId);

    return {
      membershipId: authorization.membership.id,
      organizationId: null,
      role: authorization.role,
      userId,
      adminProfileId: authorization.adminProfileId,
      privilegeType:
        authorization.role === MembershipRole.SUPER_ADMIN
          ? SessionPrivilegeType.SUPER_ADMIN
          : SessionPrivilegeType.DELEGATED_ADMIN,
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
        membershipId: context.membershipId,
        adminProfileId: context.adminProfileId ?? null,
        privilegeType: context.privilegeType ?? SessionPrivilegeType.STANDARD,
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
