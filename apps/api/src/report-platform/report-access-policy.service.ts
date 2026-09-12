import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CandidateCounsellorAssignmentStatus,
  CommerceEntitlementStatus,
  CommerceEntitlementType,
  CommerceReportAccessGrantStatus,
  CommerceReportPrincipalType,
  MembershipRole,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";

@Injectable()
export class ReportAccessPolicyService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async assertCanOpenFullReport(context: AuthContext, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        assignment: { select: { organizationId: true, userId: true, metadata: true } },
      },
    });
    if (!attempt)
      throw new NotFoundException({
        code: "ASSESSMENT_REPORT_NOT_FOUND",
        message: "Assessment report not found.",
      });

    const organizationId = attempt.assignment.organizationId;
    const isAdministrativeRole =
      context.role === MembershipRole.SUPER_ADMIN || context.role === MembershipRole.PLATFORM_ADMIN;
    const canAdministrativelyView =
      isAdministrativeRole &&
      (context.permissions?.includes("*") || context.permissions?.includes("report.view.full"));
    if (
      canAdministrativelyView &&
      (context.organizationId === null || context.organizationId === organizationId)
    ) {
      return { allowed: true as const, basis: "ADMINISTRATIVE_SCOPE" as const, attempt };
    }

    if (context.role === MembershipRole.STUDENT || context.role === MembershipRole.EMPLOYEE) {
      if (context.userId !== attempt.assignment.userId || context.organizationId !== organizationId)
        this.deny();
      if (!this.commerceApplies(attempt.assignment.metadata)) {
        return { allowed: true as const, basis: "CANDIDATE_NON_COMMERCIAL" as const, attempt };
      }
      const entitlement = await this.prisma.commerceEntitlement.findFirst({
        where: {
          attemptId,
          userId: context.userId,
          type: CommerceEntitlementType.REPORT,
          status: CommerceEntitlementStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (!entitlement) this.deny();
      return { allowed: true as const, basis: "CANDIDATE_ENTITLEMENT" as const, attempt };
    }

    if (context.role === MembershipRole.COUNSELLOR) {
      if (context.organizationId !== organizationId) this.deny();
      const [assignment, grant] = await Promise.all([
        this.prisma.candidateCounsellorAssignment.findFirst({
          where: {
            organizationId,
            candidateUserId: attempt.assignment.userId,
            counsellorUserId: context.userId,
            status: CandidateCounsellorAssignmentStatus.ACTIVE,
          },
          select: { id: true },
        }),
        this.activeGrant(attemptId, CommerceReportPrincipalType.USER, context.userId),
      ]);
      if (!assignment || !grant) this.deny();
      return { allowed: true as const, basis: "COUNSELLOR_GRANT" as const, attempt };
    }

    if (context.role === MembershipRole.ORGANIZATION_ADMIN) {
      if (context.organizationId !== organizationId) this.deny();
      const grant = await this.activeGrant(
        attemptId,
        CommerceReportPrincipalType.ORGANIZATION,
        organizationId,
      );
      if (!grant) this.deny();
      return { allowed: true as const, basis: "ORGANIZATION_GRANT" as const, attempt };
    }

    this.deny();
  }

  public async assertCanDownloadFullReport(context: AuthContext, attemptId: string) {
    const decision = await this.assertCanOpenFullReport(context, attemptId);
    if (
      decision.basis === "ADMINISTRATIVE_SCOPE" &&
      !context.permissions?.includes("*") &&
      !context.permissions?.includes("report.download")
    ) {
      this.deny();
    }
    return decision;
  }

  public async assertCanRetryAutomaticReport(context: AuthContext, attemptId: string) {
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { assignment: { select: { organizationId: true } } },
    });
    if (!attempt) {
      throw new NotFoundException({
        code: "ASSESSMENT_REPORT_NOT_FOUND",
        message: "Assessment report not found.",
      });
    }
    const centralAdministrator =
      context.role === MembershipRole.SUPER_ADMIN || context.role === MembershipRole.PLATFORM_ADMIN;
    const permitted =
      context.permissions?.includes("*") || context.permissions?.includes("assessment.manage");
    if (
      !centralAdministrator ||
      !permitted ||
      (context.organizationId !== null &&
        context.organizationId !== attempt.assignment.organizationId)
    ) {
      this.deny();
    }
    return attempt;
  }

  private activeGrant(attemptId: string, type: CommerceReportPrincipalType, principalId: string) {
    return this.prisma.commerceReportAccessGrant.findFirst({
      where: {
        attemptId,
        principalType: type,
        principalUserId: type === CommerceReportPrincipalType.USER ? principalId : null,
        principalOrganizationId:
          type === CommerceReportPrincipalType.ORGANIZATION ? principalId : null,
        status: CommerceReportAccessGrantStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
  }

  private commerceApplies(metadata: unknown): boolean {
    return Boolean(
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).registrationSource === "PUBLIC_SIGNUP",
    );
  }

  private deny(): never {
    throw new ForbiddenException({
      code: "REPORT_FULL_ACCESS_DENIED",
      message: "You do not have access to this full report.",
    });
  }
}
