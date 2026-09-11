import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CandidateCounsellorAssignmentStatus,
  CommerceCreditLedgerEventType,
  CommerceCreditType,
  CommerceCreditWalletOwnerType,
  CommerceCreditWalletStatus,
  CommerceReportAccessGrantSource,
  CommerceReportAccessGrantStatus,
  CommerceReportPrincipalType,
  MembershipStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { ConsumeReportCreditDto, CreateWalletDto } from "./report-platform.types";

@Injectable()
export class ReportCreditService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async createOrGetWallet(context: AuthContext, input: CreateWalletDto) {
    this.assertOwnerShape(input.ownerType, input.ownerUserId, input.ownerOrganizationId);
    await this.assertOwnerInScope(
      context,
      input.ownerType,
      input.ownerUserId,
      input.ownerOrganizationId,
    );
    const where = this.walletOwnerWhere(
      input.ownerType,
      input.ownerUserId,
      input.ownerOrganizationId,
    );
    const existing = await this.prisma.commerceCreditWallet.findFirst({ where });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const wallet = await tx.commerceCreditWallet.create({
            data: {
              ownerType: input.ownerType,
              ownerUserId: input.ownerUserId ?? null,
              ownerOrganizationId: input.ownerOrganizationId ?? null,
              creditType: CommerceCreditType.REPORT_ACCESS,
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: context.organizationId,
              actorUserId: context.userId,
              action: "report.credit.wallet.created",
              entityType: "CommerceCreditWallet",
              entityId: wallet.id,
              metadata: {
                ownerType: wallet.ownerType,
                ownerUserId: wallet.ownerUserId,
                ownerOrganizationId: wallet.ownerOrganizationId,
              },
            },
          });
          return wallet;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const wallet = await this.prisma.commerceCreditWallet.findFirst({ where });
        if (wallet) return wallet;
      }
      throw error;
    }
  }

  public async getWallet(context: AuthContext, walletId: string) {
    return this.requireWalletInScope(this.prisma, context, walletId);
  }

  public async ledger(context: AuthContext, walletId: string, page = 1, pageSize = 50) {
    await this.requireWalletInScope(this.prisma, context, walletId);
    const [total, items] = await Promise.all([
      this.prisma.commerceCreditLedgerEntry.count({ where: { walletId } }),
      this.prisma.commerceCreditLedgerEntry.findMany({
        where: { walletId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  public allot(context: AuthContext, walletId: string, quantity: number, reference?: string) {
    return this.applyCredit(
      context,
      walletId,
      quantity,
      CommerceCreditLedgerEventType.ADMIN_ALLOTMENT,
      reference,
    );
  }

  public async revokeUnusedAdminCredits(
    context: AuthContext,
    walletId: string,
    quantity: number,
    reference?: string,
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) this.invalidQuantity();
    return this.prisma.$transaction(
      async (tx) => {
        const wallet = await this.requireWalletInScope(tx, context, walletId);
        if (wallet.status !== CommerceCreditWalletStatus.ACTIVE) this.inactiveWallet();
        const totals = await tx.commerceCreditLedgerEntry.groupBy({
          by: ["eventType"],
          where: {
            walletId,
            eventType: {
              in: [
                CommerceCreditLedgerEventType.ADMIN_ALLOTMENT,
                CommerceCreditLedgerEventType.REVOCATION,
              ],
            },
          },
          _sum: { delta: true },
        });
        const unusedAdminCredits = Math.min(
          wallet.currentBalance,
          totals.reduce((sum, row) => sum + (row._sum.delta ?? 0), 0),
        );
        if (quantity > unusedAdminCredits)
          throw new ConflictException({
            code: "REPORT_CREDIT_REVOCATION_EXCEEDS_UNUSED_ALLOTMENT",
            message: "Only unused administrator-allotted credits may be revoked.",
          });
        return this.writeBalanceMutation(
          tx,
          context,
          walletId,
          -quantity,
          CommerceCreditLedgerEventType.REVOCATION,
          reference,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  public async consumeForAttempt(
    context: AuthContext,
    walletId: string,
    input: ConsumeReportCreditDto,
  ) {
    this.assertPrincipalShape(
      input.principalType,
      input.principalUserId,
      input.principalOrganizationId,
    );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.commerceReportAccessGrant.findFirst({
            where: {
              attemptId: input.attemptId,
              principalType: input.principalType,
              principalUserId: input.principalUserId ?? null,
              principalOrganizationId: input.principalOrganizationId ?? null,
              source: CommerceReportAccessGrantSource.CREDIT,
            },
            include: { creditLedgerEntry: true },
          });
          if (existing)
            return { grant: existing, ledgerEntry: existing.creditLedgerEntry, charged: false };

          const wallet = await this.requireWalletInScope(tx, context, walletId);
          if (wallet.status !== CommerceCreditWalletStatus.ACTIVE) this.inactiveWallet();
          this.assertWalletOwnsPrincipal(wallet, input);
          await this.assertEligibleAttempt(tx, wallet, input);

          const createdGrant = await tx.commerceReportAccessGrant.create({
            data: {
              attemptId: input.attemptId,
              principalType: input.principalType,
              principalUserId: input.principalUserId ?? null,
              principalOrganizationId: input.principalOrganizationId ?? null,
              source: CommerceReportAccessGrantSource.CREDIT,
              status: CommerceReportAccessGrantStatus.ACTIVE,
              grantedByUserId: context.userId,
            },
          });

          const updated = await tx.commerceCreditWallet.updateMany({
            where: {
              id: walletId,
              status: CommerceCreditWalletStatus.ACTIVE,
              currentBalance: { gte: 1 },
            },
            data: { currentBalance: { decrement: 1 } },
          });
          if (updated.count !== 1)
            throw new ConflictException({
              code: "REPORT_CREDIT_INSUFFICIENT_BALANCE",
              message: "The report-credit wallet has insufficient balance.",
            });
          const balance = await tx.commerceCreditWallet.findUniqueOrThrow({
            where: { id: walletId },
            select: { currentBalance: true },
          });
          const ledgerEntry = await tx.commerceCreditLedgerEntry.create({
            data: {
              walletId,
              eventType: CommerceCreditLedgerEventType.CONSUMPTION,
              quantity: 1,
              delta: -1,
              balanceAfter: balance.currentBalance,
              attemptId: input.attemptId,
              reportAccessGrantId: createdGrant.id,
              actorUserId: context.userId,
              reference: input.reference?.trim() || null,
            },
          });
          const grant = await tx.commerceReportAccessGrant.update({
            where: { id: createdGrant.id },
            data: { creditLedgerEntryId: ledgerEntry.id },
          });
          await tx.auditLog.create({
            data: {
              organizationId: context.organizationId,
              actorUserId: context.userId,
              action: "report.credit.consumed",
              entityType: "CommerceReportAccessGrant",
              entityId: grant.id,
              metadata: {
                walletId,
                ledgerEntryId: ledgerEntry.id,
                attemptId: input.attemptId,
                principalType: input.principalType,
              },
            },
          });
          return { grant, ledgerEntry, charged: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        const existing = await this.prisma.commerceReportAccessGrant.findFirst({
          where: {
            attemptId: input.attemptId,
            principalType: input.principalType,
            principalUserId: input.principalUserId ?? null,
            principalOrganizationId: input.principalOrganizationId ?? null,
            source: CommerceReportAccessGrantSource.CREDIT,
          },
          include: { creditLedgerEntry: true },
        });
        if (existing)
          return { grant: existing, ledgerEntry: existing.creditLedgerEntry, charged: false };
      }
      throw error;
    }
  }

  private applyCredit(
    context: AuthContext,
    walletId: string,
    quantity: number,
    eventType: CommerceCreditLedgerEventType,
    reference?: string,
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) this.invalidQuantity();
    return this.prisma.$transaction(
      async (tx) => {
        const wallet = await this.requireWalletInScope(tx, context, walletId);
        if (wallet.status !== CommerceCreditWalletStatus.ACTIVE) this.inactiveWallet();
        return this.writeBalanceMutation(tx, context, walletId, quantity, eventType, reference);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async writeBalanceMutation(
    tx: Prisma.TransactionClient,
    context: AuthContext,
    walletId: string,
    delta: number,
    eventType: CommerceCreditLedgerEventType,
    reference?: string,
  ) {
    const wallet = await tx.commerceCreditWallet.update({
      where: { id: walletId },
      data: { currentBalance: { increment: delta } },
      select: { currentBalance: true },
    });
    if (wallet.currentBalance < 0)
      throw new ConflictException({
        code: "REPORT_CREDIT_INSUFFICIENT_BALANCE",
        message: "The report-credit wallet cannot have a negative balance.",
      });
    const entry = await tx.commerceCreditLedgerEntry.create({
      data: {
        walletId,
        eventType,
        quantity: Math.abs(delta),
        delta,
        balanceAfter: wallet.currentBalance,
        actorUserId: context.userId,
        reference: reference?.trim() || null,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action:
          eventType === CommerceCreditLedgerEventType.ADMIN_ALLOTMENT
            ? "report.credit.allotted"
            : "report.credit.revoked",
        entityType: "CommerceCreditLedgerEntry",
        entityId: entry.id,
        metadata: { walletId, quantity: Math.abs(delta), balanceAfter: wallet.currentBalance },
      },
    });
    return { walletId, balance: wallet.currentBalance, ledgerEntry: entry };
  }

  private async requireWalletInScope(
    client: PrismaClient | Prisma.TransactionClient,
    context: AuthContext,
    walletId: string,
  ) {
    const wallet = await client.commerceCreditWallet.findFirst({
      where: {
        id: walletId,
        ...(context.organizationId === null
          ? {}
          : {
              OR: [
                { ownerOrganizationId: context.organizationId },
                {
                  ownerUser: {
                    memberships: {
                      some: {
                        organizationId: context.organizationId,
                        status: MembershipStatus.ACTIVE,
                      },
                    },
                  },
                },
              ],
            }),
      },
    });
    if (!wallet)
      throw new NotFoundException({
        code: "REPORT_CREDIT_WALLET_NOT_FOUND",
        message: "Report-credit wallet not found in your scope.",
      });
    return wallet;
  }

  private async assertOwnerInScope(
    context: AuthContext,
    ownerType: CommerceCreditWalletOwnerType,
    userId?: string,
    organizationId?: string,
  ) {
    if (context.organizationId === null) return;
    if (ownerType === CommerceCreditWalletOwnerType.ORGANIZATION) {
      if (organizationId !== context.organizationId) this.scopeDenied();
      return;
    }
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId: context.organizationId,
        userId: userId!,
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!membership) this.scopeDenied();
  }

  private async assertEligibleAttempt(
    tx: Prisma.TransactionClient,
    wallet: {
      ownerType: CommerceCreditWalletOwnerType;
      ownerUserId: string | null;
      ownerOrganizationId: string | null;
    },
    input: ConsumeReportCreditDto,
  ) {
    const attempt = await tx.assessmentAttempt.findUnique({
      where: { id: input.attemptId },
      select: { assignment: { select: { organizationId: true, userId: true } } },
    });
    if (!attempt)
      throw new NotFoundException({
        code: "ASSESSMENT_ATTEMPT_NOT_FOUND",
        message: "Eligible assessment attempt not found.",
      });
    if (
      wallet.ownerType === CommerceCreditWalletOwnerType.ORGANIZATION &&
      attempt.assignment.organizationId !== wallet.ownerOrganizationId
    )
      this.scopeDenied();
    if (wallet.ownerType === CommerceCreditWalletOwnerType.USER) {
      const assignment = await tx.candidateCounsellorAssignment.findFirst({
        where: {
          organizationId: attempt.assignment.organizationId,
          candidateUserId: attempt.assignment.userId,
          counsellorUserId: wallet.ownerUserId!,
          status: CandidateCounsellorAssignmentStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!assignment)
        throw new ForbiddenException({
          code: "COUNSELLOR_CANDIDATE_NOT_ASSIGNED",
          message: "The candidate is not actively assigned to this counsellor.",
        });
    }
  }

  private assertWalletOwnsPrincipal(
    wallet: {
      ownerType: CommerceCreditWalletOwnerType;
      ownerUserId: string | null;
      ownerOrganizationId: string | null;
    },
    input: ConsumeReportCreditDto,
  ) {
    const valid =
      wallet.ownerType === CommerceCreditWalletOwnerType.USER
        ? input.principalType === CommerceReportPrincipalType.USER &&
          input.principalUserId === wallet.ownerUserId
        : input.principalType === CommerceReportPrincipalType.ORGANIZATION &&
          input.principalOrganizationId === wallet.ownerOrganizationId;
    if (!valid)
      throw new BadRequestException({
        code: "REPORT_CREDIT_PRINCIPAL_MISMATCH",
        message: "The report access principal must own the wallet.",
      });
  }

  private walletOwnerWhere(
    ownerType: CommerceCreditWalletOwnerType,
    userId?: string,
    organizationId?: string,
  ) {
    return {
      ownerType,
      ownerUserId: userId ?? null,
      ownerOrganizationId: organizationId ?? null,
      creditType: CommerceCreditType.REPORT_ACCESS,
    };
  }
  private assertOwnerShape(
    type: CommerceCreditWalletOwnerType,
    userId?: string,
    organizationId?: string,
  ) {
    if (
      (type === CommerceCreditWalletOwnerType.USER && (!userId || organizationId)) ||
      (type === CommerceCreditWalletOwnerType.ORGANIZATION && (!organizationId || userId))
    )
      throw new BadRequestException({
        code: "REPORT_CREDIT_OWNER_INVALID",
        message: "Exactly one wallet owner matching ownerType is required.",
      });
  }
  private assertPrincipalShape(
    type: CommerceReportPrincipalType,
    userId?: string,
    organizationId?: string,
  ) {
    if (
      (type === CommerceReportPrincipalType.USER && (!userId || organizationId)) ||
      (type === CommerceReportPrincipalType.ORGANIZATION && (!organizationId || userId))
    )
      throw new BadRequestException({
        code: "REPORT_ACCESS_PRINCIPAL_INVALID",
        message: "Exactly one report access principal matching principalType is required.",
      });
  }
  private invalidQuantity(): never {
    throw new BadRequestException({
      code: "REPORT_CREDIT_QUANTITY_INVALID",
      message: "Credit quantity must be a positive integer.",
    });
  }
  private inactiveWallet(): never {
    throw new ConflictException({
      code: "REPORT_CREDIT_WALLET_INACTIVE",
      message: "The report-credit wallet is not active.",
    });
  }
  private scopeDenied(): never {
    throw new ForbiddenException({
      code: "ORGANIZATION_SCOPE_VIOLATION",
      message: "The requested report-credit operation is outside your organization scope.",
    });
  }
}
