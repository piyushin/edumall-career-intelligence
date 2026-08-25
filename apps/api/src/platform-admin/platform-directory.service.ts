import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AdminProfileStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  Prisma,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { boundedLimit, decodeCreatedCursor, pageResult } from "./platform-admin-pagination";
import type { OrganizationDirectoryQueryDto, UserDirectoryQueryDto } from "./platform-admin.types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PlatformDirectoryService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async dashboard(context: AuthContext) {
    this.assertPlatform(context);
    const can = (permission: string) =>
      context.role === MembershipRole.SUPER_ADMIN ||
      (context.permissions ?? []).includes(permission);

    const [
      totalUsers,
      activeUsers,
      organizations,
      activeOrganizations,
      platformAdmins,
      delegatedAdmins,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({
        where: { status: OrganizationStatus.ACTIVE, deletedAt: null },
      }),
      this.prisma.organizationMembership.count({
        where: {
          role: MembershipRole.SUPER_ADMIN,
          status: MembershipStatus.ACTIVE,
          organization: { type: "PLATFORM", deletedAt: null },
        },
      }),
      this.prisma.adminProfile.count({ where: { status: AdminProfileStatus.ACTIVE } }),
    ]);

    const summary: Record<string, unknown> = {
      generatedAt: new Date(),
      users: { total: totalUsers, active: activeUsers },
      organizations: { total: organizations, active: activeOrganizations },
      administrators: { platformSuperAdmins: platformAdmins, delegatedActive: delegatedAdmins },
    };

    if (can("candidate.view")) {
      summary.candidates = {
        total: await this.prisma.user.count({
          where: { deletedAt: null, assignedAssessments: { some: {} } },
        }),
      };
    }

    if (can("assessment.view")) {
      const [definitions, assignments, inProgress, submitted, abandoned, released, unreleased] =
        await Promise.all([
          this.prisma.assessmentDefinition.count(),
          this.prisma.assessmentAssignment.count(),
          this.prisma.assessmentAttempt.count({ where: { status: "IN_PROGRESS" } }),
          this.prisma.assessmentAttempt.count({ where: { status: "SUBMITTED" } }),
          this.prisma.assessmentAttempt.count({ where: { status: "ABANDONED" } }),
          this.prisma.assessmentReportRelease.count(),
          this.prisma.assessmentAttempt.count({
            where: { status: "SUBMITTED", reportReleases: { none: {} } },
          }),
        ]);
      summary.assessments = {
        definitions,
        assignments,
        attempts: { inProgress, submitted, abandoned },
        reports: { released, awaitingRelease: unreleased },
      };
    }

    if (can("commerce.view")) {
      const [orders, paidOrders, payments, entitlements] = await Promise.all([
        this.prisma.commerceOrder.count(),
        this.prisma.commerceOrder.count({ where: { status: "PAID" } }),
        this.prisma.commercePayment.count({
          where: { status: { in: ["SUCCEEDED", "MANUAL_APPROVED"] } },
        }),
        this.prisma.commerceEntitlement.count({ where: { status: "ACTIVE" } }),
      ]);
      summary.commerce = {
        orders,
        paidOrders,
        capturedPayments: payments,
        activeEntitlements: entitlements,
      };
    }

    if (can("audit.view")) {
      summary.recentActivity = await this.prisma.auditLog.findMany({
        take: 10,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          actorUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          organizationId: true,
          outcome: true,
          purpose: true,
          createdAt: true,
        },
      });
    }
    return summary;
  }

  public async organizations(context: AuthContext, query: OrganizationDirectoryQueryDto) {
    this.assertPlatform(context);
    const limit = boundedLimit(query.limit);
    const cursor = decodeCreatedCursor(query.cursor);
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      AND: [
        ...(query.search?.trim()
          ? [
              {
                OR: [
                  { name: { contains: query.search.trim(), mode: "insensitive" as const } },
                  {
                    slug: {
                      contains: query.search.trim().toLowerCase(),
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    };
    const rows = await this.prisma.organization.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, slug: true, type: true, status: true, createdAt: true },
    });
    const page = pageResult(rows, limit);
    const ids = page.items.map((item) => item.id);
    const [members, active, admins] = await Promise.all([
      this.prisma.organizationMembership.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.organizationMembership.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: ids }, status: MembershipStatus.ACTIVE },
        _count: { _all: true },
      }),
      this.prisma.organizationMembership.groupBy({
        by: ["organizationId"],
        where: {
          organizationId: { in: ids },
          status: MembershipStatus.ACTIVE,
          role: {
            in: [
              MembershipRole.SUPER_ADMIN,
              MembershipRole.PLATFORM_ADMIN,
              MembershipRole.ORGANIZATION_ADMIN,
            ],
          },
        },
        _count: { _all: true },
      }),
    ]);
    const countMap = (values: typeof members) =>
      new Map(values.map((value) => [value.organizationId, value._count._all]));
    const memberMap = countMap(members),
      activeMap = countMap(active),
      adminMap = countMap(admins);
    return {
      ...page,
      items: page.items.map((item) => ({
        ...item,
        memberCount: memberMap.get(item.id) ?? 0,
        activeMemberCount: activeMap.get(item.id) ?? 0,
        administratorCount: adminMap.get(item.id) ?? 0,
      })),
    };
  }

  public async organization(context: AuthContext, id: string) {
    this.assertPlatform(context);
    const organization = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { memberships: true, assessmentAssignments: true, commerceOrders: true },
        },
      },
    });
    if (!organization)
      throw new NotFoundException({
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    const [activeMemberCount, administratorCount] = await Promise.all([
      this.prisma.organizationMembership.count({
        where: { organizationId: id, status: MembershipStatus.ACTIVE },
      }),
      this.prisma.organizationMembership.count({
        where: {
          organizationId: id,
          status: MembershipStatus.ACTIVE,
          role: {
            in: [
              MembershipRole.SUPER_ADMIN,
              MembershipRole.PLATFORM_ADMIN,
              MembershipRole.ORGANIZATION_ADMIN,
            ],
          },
        },
      }),
    ]);
    return { ...organization, activeMemberCount, administratorCount };
  }

  public async users(context: AuthContext, query: UserDirectoryQueryDto) {
    this.assertPlatform(context);
    const canViewCommerce = this.can(context, "commerce.view");
    if ((query.paymentState || query.entitlementState) && !canViewCommerce) {
      throw new ForbiddenException({
        code: "COMMERCE_PERMISSION_REQUIRED",
        message: "Commerce permission is required for payment or entitlement filters.",
      });
    }
    const limit = boundedLimit(query.limit);
    const cursor = decodeCreatedCursor(query.cursor);
    const search = query.search?.trim();
    const filters: Prisma.UserWhereInput[] = [];
    if (search)
      filters.push({
        OR: [
          ...(UUID_PATTERN.test(search) ? [{ id: search }] : []),
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      });
    if (query.organizationId || query.role)
      filters.push({
        memberships: {
          some: {
            ...(query.organizationId ? { organizationId: query.organizationId } : {}),
            ...(query.role ? { role: query.role } : {}),
          },
        },
      });
    if (query.candidateSegment)
      filters.push({
        assignedAssessments: {
          some: { metadata: { path: ["productSegment"], equals: query.candidateSegment } },
        },
      });
    if (query.assessmentState)
      filters.push({
        assignedAssessments: { some: { attempts: { some: { status: query.assessmentState } } } },
      });
    if (query.reportState === "RELEASED")
      filters.push({
        assignedAssessments: { some: { attempts: { some: { reportReleases: { some: {} } } } } },
      });
    if (query.reportState === "NOT_RELEASED")
      filters.push({
        assignedAssessments: { some: { attempts: { some: { reportReleases: { none: {} } } } } },
      });
    if (query.paymentState)
      filters.push({ commerceOrders: { some: { status: query.paymentState } } });
    if (query.entitlementState)
      filters.push({ commerceEntitlements: { some: { status: query.entitlementState } } });
    if (cursor)
      filters.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      AND: filters,
    };
    const rows = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          take: 100,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            role: true,
            status: true,
            organization: { select: { id: true, name: true, slug: true, type: true } },
          },
        },
        _count: {
          select: {
            assignedAssessments: true,
            ...(canViewCommerce ? { commerceOrders: true, commerceEntitlements: true } : {}),
          },
        },
      },
    });
    return pageResult(rows, limit);
  }

  public async user(context: AuthContext, id: string) {
    this.assertPlatform(context);
    const canViewAdmins = this.can(context, "admin.view");
    const canViewCommerce = this.can(context, "commerce.view");
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          take: 100,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            organization: {
              select: { id: true, name: true, slug: true, type: true, status: true },
            },
          },
        },
        adminProfile: canViewAdmins
          ? {
              select: {
                id: true,
                status: true,
                title: true,
                responsibility: true,
                assignments: {
                  where: { revokedAt: null },
                  take: 100,
                  orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
                  select: {
                    id: true,
                    scopeType: true,
                    organizationId: true,
                    roleTemplate: { select: { code: true, name: true } },
                  },
                },
              },
            }
          : false,
        assignedAssessments: {
          orderBy: { assignedAt: "desc" },
          take: 25,
          select: {
            id: true,
            status: true,
            assignedAt: true,
            organizationId: true,
            attempts: {
              take: 10,
              orderBy: [{ startedAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                submittedAt: true,
                _count: { select: { reportReleases: true } },
              },
            },
          },
        },
        commerceOrders: canViewCommerce
          ? {
              orderBy: { createdAt: "desc" },
              take: 25,
              select: {
                id: true,
                organizationId: true,
                status: true,
                totalMinor: true,
                currency: true,
                createdAt: true,
              },
            }
          : false,
        commerceEntitlements: canViewCommerce
          ? {
              orderBy: { grantedAt: "desc" },
              take: 25,
              select: {
                id: true,
                organizationId: true,
                type: true,
                status: true,
                grantedAt: true,
                expiresAt: true,
              },
            }
          : false,
      },
    });
    if (!user) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "User not found." });
    return user;
  }

  private assertPlatform(context: AuthContext) {
    if (
      context.organizationId !== null ||
      (context.role !== MembershipRole.SUPER_ADMIN &&
        context.role !== MembershipRole.PLATFORM_ADMIN)
    ) {
      throw new ForbiddenException({
        code: "PLATFORM_SCOPE_REQUIRED",
        message: "Platform authorization is required.",
      });
    }
  }

  private can(context: AuthContext, permission: string): boolean {
    return (
      context.role === MembershipRole.SUPER_ADMIN ||
      (context.permissions ?? []).includes(permission)
    );
  }
}
