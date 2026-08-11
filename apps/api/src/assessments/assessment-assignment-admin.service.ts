import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentAssignmentStatus,
  AssessmentDefinitionStatus,
  AssessmentVersionStatus,
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  Prisma,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { CreateAssessmentAssignmentDto } from "./assessment-assignment-admin.types";

const CANDIDATE_ROLES = [MembershipRole.STUDENT, MembershipRole.EMPLOYEE] as const;

@Injectable()
export class AssessmentAssignmentAdminService {
  public constructor(
    @Inject(DATABASE_PRISMA)
    private readonly prisma: PrismaClient,
  ) {}

  public async listAssignments(context: AuthContext, requestedOrganizationId?: string) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    return this.prisma.assessmentAssignment.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        assignedAt: "desc",
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        maxAttempts: true,
        availableFrom: true,
        expiresAt: true,
        assignedAt: true,
        cancelledAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        assessmentVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            title: true,
            edition: true,
            form: true,
            language: true,
            assessmentDefinition: {
              select: {
                id: true,
                code: true,
                organizationId: true,
              },
            },
          },
        },
        attempts: {
          orderBy: {
            attemptNumber: "desc",
          },
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            abandonedAt: true,
          },
        },
      },
    });
  }

  public async listEligibleCandidates(context: AuthContext, requestedOrganizationId?: string) {
    const organizationId = await this.resolveOrganizationId(context, requestedOrganizationId);

    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
        role: {
          in: [...CANDIDATE_ROLES],
        },
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      ...membership.user,
    }));
  }

  public async createAssignment(context: AuthContext, input: CreateAssessmentAssignmentDto) {
    try {
      return await this.prisma.$transaction(
        (tx) => this.createAssignmentInTransaction(context, input, tx),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException({
          code: "ASSESSMENT_ASSIGNMENT_CONCURRENCY_CONFLICT",
          message: "Another assignment operation occurred concurrently. Please retry.",
        });
      }

      throw error;
    }
  }

  private async createAssignmentInTransaction(
    context: AuthContext,
    input: CreateAssessmentAssignmentDto,
    tx: Prisma.TransactionClient,
  ) {
    const organizationId = await this.resolveOrganizationId(context, input.organizationId);
    const availableFrom = input.availableFrom ? new Date(input.availableFrom) : null;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const maxAttempts = input.maxAttempts ?? 1;

    if (availableFrom && expiresAt && availableFrom >= expiresAt) {
      throw new BadRequestException({
        code: "ASSESSMENT_ASSIGNMENT_INVALID_WINDOW",
        message: "Assessment expiry must be later than its availability time.",
      });
    }

    const version = await tx.assessmentVersion.findFirst({
      where: {
        id: input.assessmentVersionId,
        status: AssessmentVersionStatus.PUBLISHED,
        assessmentDefinition: {
          status: AssessmentDefinitionStatus.ACTIVE,
          OR: [{ organizationId: null }, { organizationId }],
        },
      },
      select: {
        id: true,
        status: true,
        assessmentDefinition: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException({
        code: "ASSIGNABLE_ASSESSMENT_VERSION_NOT_FOUND",
        message: "A published assessment version available to this organization was not found.",
      });
    }

    const candidateMembership = await tx.organizationMembership.findFirst({
      where: {
        organizationId,
        userId: input.userId,
        status: MembershipStatus.ACTIVE,
        role: {
          in: [...CANDIDATE_ROLES],
        },
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!candidateMembership) {
      throw new NotFoundException({
        code: "ASSESSMENT_CANDIDATE_NOT_ELIGIBLE",
        message: "The selected user is not an active student or employee in this organization.",
      });
    }

    const now = new Date();
    const duplicate = await tx.assessmentAssignment.findFirst({
      where: {
        organizationId,
        assessmentVersionId: version.id,
        userId: input.userId,
        status: AssessmentAssignmentStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException({
        code: "ASSESSMENT_ASSIGNMENT_ALREADY_ACTIVE",
        message: "This candidate already has an active assignment for this assessment version.",
      });
    }

    return tx.assessmentAssignment.create({
      data: {
        organizationId,
        assessmentVersionId: version.id,
        userId: input.userId,
        assignedByUserId: context.userId,
        maxAttempts,
        availableFrom,
        expiresAt,
      },
      select: {
        id: true,
        organizationId: true,
        assessmentVersionId: true,
        userId: true,
        assignedByUserId: true,
        status: true,
        maxAttempts: true,
        availableFrom: true,
        expiresAt: true,
        assignedAt: true,
      },
    });
  }

  public async cancelAssignment(context: AuthContext, assignmentId: string) {
    const contextOrganizationId =
      context.role === MembershipRole.SUPER_ADMIN ? null : this.requireOrganizationContext(context);

    const assignment = await this.prisma.assessmentAssignment.findFirst({
      where: {
        id: assignmentId,
        ...(contextOrganizationId ? { organizationId: contextOrganizationId } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        cancelledAt: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException({
        code: "ASSESSMENT_ASSIGNMENT_NOT_FOUND",
        message: "Assessment assignment not found.",
      });
    }

    if (assignment.status === AssessmentAssignmentStatus.CANCELLED) {
      return assignment;
    }

    if (assignment.status !== AssessmentAssignmentStatus.ACTIVE) {
      throw new ConflictException({
        code: "ASSESSMENT_ASSIGNMENT_NOT_CANCELLABLE",
        message: "Only active assessment assignments can be cancelled.",
      });
    }

    const cancelledAt = new Date();

    return this.prisma.assessmentAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        status: AssessmentAssignmentStatus.CANCELLED,
        cancelledAt,
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        cancelledAt: true,
      },
    });
  }

  private async resolveOrganizationId(
    context: AuthContext,
    requestedOrganizationId?: string,
  ): Promise<string> {
    if (context.role !== MembershipRole.SUPER_ADMIN) {
      const organizationId = this.requireOrganizationContext(context);

      if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
        throw new ForbiddenException({
          code: "ORGANIZATION_SCOPE_VIOLATION",
          message: "You cannot manage assessment assignments for another organization.",
        });
      }

      return organizationId;
    }

    if (!requestedOrganizationId) {
      throw new BadRequestException({
        code: "ORGANIZATION_ID_REQUIRED",
        message: "An organization must be selected for this operation.",
      });
    }

    const organization = await this.prisma.organization.findFirst({
      where: {
        id: requestedOrganizationId,
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException({
        code: "ORGANIZATION_NOT_FOUND",
        message: "Active organization not found.",
      });
    }

    return organization.id;
  }

  private requireOrganizationContext(context: AuthContext): string {
    if (!context.organizationId) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_REQUIRED",
        message: "An organization-scoped session is required.",
      });
    }

    return context.organizationId;
  }
}
