import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CandidateCounsellorAssignmentStatus,
  MembershipRole,
  MembershipStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { CreateCounsellorAssignmentDto } from "./report-platform.types";

@Injectable()
export class CandidateCounsellorAssignmentService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public list(context: AuthContext, organizationId?: string) {
    const scope = this.scope(context, organizationId);
    return this.prisma.candidateCounsellorAssignment.findMany({
      where: {
        ...(scope ? { organizationId: scope } : {}),
        ...(context.role === MembershipRole.COUNSELLOR ? { counsellorUserId: context.userId } : {}),
      },
      orderBy: { assignedAt: "desc" },
      include: {
        candidateUser: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true },
        },
        counsellorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  public async assign(context: AuthContext, input: CreateCounsellorAssignmentDto) {
    this.scope(context, input.organizationId);
    if (input.candidateUserId === input.counsellorUserId)
      throw new ConflictException({
        code: "COUNSELLOR_ASSIGNMENT_SAME_USER",
        message: "A candidate cannot be assigned to themselves as counsellor.",
      });
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: input.organizationId,
        userId: { in: [input.candidateUserId, input.counsellorUserId] },
        status: MembershipStatus.ACTIVE,
      },
      select: { userId: true, role: true },
    });
    const candidate = memberships.find((membership) => membership.userId === input.candidateUserId);
    const counsellor = memberships.find(
      (membership) => membership.userId === input.counsellorUserId,
    );
    if (
      !candidate ||
      !counsellor ||
      counsellor.role !== MembershipRole.COUNSELLOR ||
      (candidate.role !== MembershipRole.STUDENT && candidate.role !== MembershipRole.EMPLOYEE)
    ) {
      throw new ConflictException({
        code: "COUNSELLOR_ASSIGNMENT_MEMBERSHIP_INVALID",
        message: "Candidate and counsellor must have active matching organization memberships.",
      });
    }

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.candidateCounsellorAssignment.findFirst({
          where: {
            organizationId: input.organizationId,
            candidateUserId: input.candidateUserId,
            counsellorUserId: input.counsellorUserId,
            status: CandidateCounsellorAssignmentStatus.ACTIVE,
          },
        });
        if (existing) return existing;
        const assignment = await tx.candidateCounsellorAssignment.create({
          data: {
            organizationId: input.organizationId,
            candidateUserId: input.candidateUserId,
            counsellorUserId: input.counsellorUserId,
            assignedByUserId: context.userId,
            consentedAt: input.consentedAt ? new Date(input.consentedAt) : null,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: input.organizationId,
            actorUserId: context.userId,
            subjectUserId: input.candidateUserId,
            action: "counsellor.assignment.created",
            entityType: "CandidateCounsellorAssignment",
            entityId: assignment.id,
            metadata: {
              counsellorUserId: input.counsellorUserId,
              consentedAt: input.consentedAt ?? null,
            },
          },
        });
        return assignment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async revoke(context: AuthContext, assignmentId: string) {
    const assignment = await this.prisma.candidateCounsellorAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment)
      throw new NotFoundException({
        code: "COUNSELLOR_ASSIGNMENT_NOT_FOUND",
        message: "Counsellor assignment not found.",
      });
    this.scope(context, assignment.organizationId);
    return this.prisma.$transaction(
      async (tx) => {
        const revoked = await tx.candidateCounsellorAssignment.update({
          where: { id: assignment.id },
          data: { status: CandidateCounsellorAssignmentStatus.REVOKED, revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            organizationId: assignment.organizationId,
            actorUserId: context.userId,
            subjectUserId: assignment.candidateUserId,
            action: "counsellor.assignment.revoked",
            entityType: "CandidateCounsellorAssignment",
            entityId: assignment.id,
            metadata: { counsellorUserId: assignment.counsellorUserId },
          },
        });
        return revoked;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private scope(context: AuthContext, requested?: string): string | undefined {
    if (context.organizationId !== null) {
      if (requested && requested !== context.organizationId)
        throw new ForbiddenException({
          code: "ORGANIZATION_SCOPE_VIOLATION",
          message: "Counsellor assignment is outside your organization scope.",
        });
      return context.organizationId;
    }
    return requested;
  }
}
