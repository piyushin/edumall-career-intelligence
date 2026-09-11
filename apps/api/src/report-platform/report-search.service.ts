import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  CandidateCounsellorAssignmentStatus,
  CommerceEntitlementType,
  CommerceReportAccessGrantStatus,
  MembershipRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { ReportSearchQueryDto } from "./report-platform.types";

@Injectable()
export class ReportSearchService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public searchAdmin(context: AuthContext, query: ReportSearchQueryDto) {
    if (
      context.role !== MembershipRole.SUPER_ADMIN &&
      context.role !== MembershipRole.PLATFORM_ADMIN &&
      context.role !== MembershipRole.ORGANIZATION_ADMIN
    ) {
      throw new ForbiddenException({
        code: "REPORT_SEARCH_DENIED",
        message: "Administrative report search is not available.",
      });
    }
    return this.search(context, query, false);
  }

  public searchStaff(context: AuthContext, query: ReportSearchQueryDto) {
    if (
      context.role !== MembershipRole.COUNSELLOR &&
      context.role !== MembershipRole.ORGANIZATION_ADMIN &&
      context.role !== MembershipRole.SUPER_ADMIN &&
      context.role !== MembershipRole.PLATFORM_ADMIN
    ) {
      throw new ForbiddenException({
        code: "REPORT_SEARCH_DENIED",
        message: "Staff report search is not available.",
      });
    }
    return this.search(context, query, context.role === MembershipRole.COUNSELLOR);
  }

  private async search(context: AuthContext, query: ReportSearchQueryDto, counsellorOnly: boolean) {
    const organizationId = this.resolveOrganizationScope(context, query.organizationId);
    const where = this.buildWhere(context, query, organizationId, counsellorOnly);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const now = new Date();
    const [total, attempts] = await Promise.all([
      this.prisma.assessmentAttempt.count({ where }),
      this.prisma.assessmentAttempt.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          attemptNumber: true,
          submittedAt: true,
          assignment: {
            select: {
              organization: { select: { id: true, name: true } },
              user: {
                select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true },
              },
              assessmentVersion: {
                select: {
                  id: true,
                  title: true,
                  versionNumber: true,
                  assessmentDefinition: { select: { id: true, code: true } },
                },
              },
            },
          },
          reportGeneration: { select: { status: true, completedAt: true } },
          commerceEntitlements: {
            where: { type: CommerceEntitlementType.REPORT },
            select: { status: true, expiresAt: true },
          },
          reportAccessGrants: {
            where: {
              status: CommerceReportAccessGrantStatus.ACTIVE,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { principalType: true, principalUserId: true, principalOrganizationId: true },
          },
        },
      }),
    ]);

    const administrativeFullAccess =
      (context.role === MembershipRole.SUPER_ADMIN ||
        context.role === MembershipRole.PLATFORM_ADMIN) &&
      (context.permissions?.includes("*") || context.permissions?.includes("report.view.full"));

    return {
      items: attempts.map((attempt) => ({
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt,
        candidate: attempt.assignment.user,
        organization: attempt.assignment.organization,
        assessment: attempt.assignment.assessmentVersion,
        generationStatus: attempt.reportGeneration?.status ?? null,
        candidateEntitlementStatus: attempt.commerceEntitlements[0]?.status ?? "NONE",
        canViewFullReport:
          administrativeFullAccess ||
          (context.role === MembershipRole.COUNSELLOR
            ? attempt.reportAccessGrants.some(
                (grant) =>
                  grant.principalType === "USER" && grant.principalUserId === context.userId,
              )
            : context.role === MembershipRole.ORGANIZATION_ADMIN
              ? attempt.reportAccessGrants.some(
                  (grant) =>
                    grant.principalType === "ORGANIZATION" &&
                    grant.principalOrganizationId === context.organizationId,
                )
              : false),
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  private resolveOrganizationScope(context: AuthContext, requested?: string): string | undefined {
    if (context.organizationId !== null) {
      if (requested && requested !== context.organizationId) {
        throw new ForbiddenException({
          code: "ORGANIZATION_SCOPE_VIOLATION",
          message: "You cannot search reports in another organization.",
        });
      }
      return context.organizationId;
    }
    return requested;
  }

  private buildWhere(
    context: AuthContext,
    query: ReportSearchQueryDto,
    organizationId: string | undefined,
    counsellorOnly: boolean,
  ): Prisma.AssessmentAttemptWhereInput {
    const and: Prisma.AssessmentAttemptWhereInput[] = [];
    if (query.q?.trim()) {
      for (const q of query.q.trim().split(/\s+/)) {
        and.push({
          OR: [
            { assignment: { user: { firstName: { contains: q, mode: "insensitive" } } } },
            { assignment: { user: { lastName: { contains: q, mode: "insensitive" } } } },
            { assignment: { user: { email: { contains: q, mode: "insensitive" } } } },
            { assignment: { user: { phoneE164: { contains: q.replace(/[\s().-]/g, "") } } } },
            { assignment: { organization: { name: { contains: q, mode: "insensitive" } } } },
            { assignment: { assessmentVersion: { title: { contains: q, mode: "insensitive" } } } },
          ],
        });
      }
    }
    if (query.candidateName?.trim()) {
      for (const token of query.candidateName.trim().split(/\s+/)) {
        and.push({
          OR: [
            { assignment: { user: { firstName: { contains: token, mode: "insensitive" } } } },
            { assignment: { user: { lastName: { contains: token, mode: "insensitive" } } } },
          ],
        });
      }
    }
    if (query.email?.trim())
      and.push({
        assignment: { user: { email: { contains: query.email.trim(), mode: "insensitive" } } },
      });
    if (query.mobile?.trim())
      and.push({
        assignment: { user: { phoneE164: { contains: query.mobile.replace(/[\s().-]/g, "") } } },
      });

    const submittedAt: Prisma.DateTimeNullableFilter = {};
    if (query.submittedDate) {
      const start = new Date(query.submittedDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      submittedAt.gte = start;
      submittedAt.lt = end;
    } else {
      if (query.submittedFrom) submittedAt.gte = new Date(query.submittedFrom);
      if (query.submittedTo) {
        const end = new Date(query.submittedTo);
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.submittedTo)) {
          end.setUTCDate(end.getUTCDate() + 1);
          submittedAt.lt = end;
        } else {
          submittedAt.lte = end;
        }
      }
    }

    const counsellorAssignments = counsellorOnly
      ? {
          some: {
            ...(organizationId ? { organizationId } : {}),
            counsellorUserId: context.userId,
            status: CandidateCounsellorAssignmentStatus.ACTIVE,
          },
        }
      : query.counsellorUserId
        ? {
            some: {
              ...(organizationId ? { organizationId } : {}),
              counsellorUserId: query.counsellorUserId,
              status: CandidateCounsellorAssignmentStatus.ACTIVE,
            },
          }
        : undefined;
    const assignment: Prisma.AssessmentAssignmentWhereInput = {
      ...(organizationId ? { organizationId } : {}),
      ...(query.tenantName?.trim()
        ? {
            organization: {
              name: { contains: query.tenantName.trim(), mode: "insensitive" as const },
            },
          }
        : {}),
      ...(query.assessmentVersionId ? { assessmentVersionId: query.assessmentVersionId } : {}),
      ...(query.assessmentId
        ? { assessmentVersion: { assessmentDefinitionId: query.assessmentId } }
        : {}),
      user: {
        ...(counsellorAssignments ? { counsellorCandidateAssignments: counsellorAssignments } : {}),
      },
    };

    return {
      status: AssessmentAttemptStatus.SUBMITTED,
      ...(Object.keys(submittedAt).length ? { submittedAt } : {}),
      assignment,
      ...(query.generationStatus ? { reportGeneration: { status: query.generationStatus } } : {}),
      ...(query.entitlementStatus
        ? {
            commerceEntitlements:
              query.entitlementStatus === "NONE"
                ? { none: { type: CommerceEntitlementType.REPORT } }
                : {
                    some: {
                      type: CommerceEntitlementType.REPORT,
                      status: query.entitlementStatus,
                    },
                  },
          }
        : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }
}
