import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CommerceCreditLedgerEventType,
  CommerceCreditType,
  CommerceCreditWalletOwnerType,
  CommerceCreditWalletStatus,
  MembershipRole,
  MembershipStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type {
  ConsumeReportCreditDto,
  CreateWalletDto,
  TransferReportCreditsDto,
  WalletSearchQueryDto,
  WalletStatusDto,
} from "./report-platform.types";
import { ReportUnlockService } from "./report-unlock.service";

export interface WalletStats {
  purchased: number;
  allotted: number;
  transferredIn: number;
  transferredOut: number;
  consumed: number;
  reversed: number;
  revoked: number;
  remaining: number;
}

const walletOwnerSelect = {
  ownerUser: {
    select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true },
  },
  ownerOrganization: { select: { id: true, name: true } },
} satisfies Prisma.CommerceCreditWalletInclude;

export const ledgerInclude = {
  actorUser: { select: { id: true, firstName: true, lastName: true, email: true } },
  order: { select: { id: true, status: true, product: { select: { code: true, name: true } } } },
  attempt: {
    select: {
      id: true,
      assignment: { select: { user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  },
  reportAccessGrant: {
    select: { id: true, principalType: true, status: true, principalOrganizationId: true },
  },
  entitlement: { select: { id: true, type: true, status: true, userId: true } },
} satisfies Prisma.CommerceCreditLedgerEntryInclude;

@Injectable()
export class ReportCreditService {
  public constructor(
    @Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient,
    @Inject(ReportUnlockService) private readonly unlocks: ReportUnlockService,
  ) {}

  public async createOrGetWallet(context: AuthContext, input: CreateWalletDto) {
    this.assertOwnerShape(input.ownerType, input.ownerUserId, input.ownerOrganizationId);
    await this.assertOwnerInScope(
      context,
      input.ownerType,
      input.ownerUserId,
      input.ownerOrganizationId,
    );
    return this.findOrCreateWallet(
      this.prisma,
      context,
      input.ownerType,
      input.ownerUserId ?? null,
      input.ownerOrganizationId ?? null,
    );
  }

  public async getWallet(context: AuthContext, walletId: string) {
    const wallet = await this.requireWalletInScope(this.prisma, context, walletId, true);
    return { ...wallet, stats: await this.stats(this.prisma, walletId) };
  }

  // Central wallet directory: organisation wallets by name, counsellor/user
  // wallets by name, mobile or email, filtered by owner type and status.
  public async searchWallets(context: AuthContext, query: WalletSearchQueryDto) {
    this.assertCentralAdministrator(context);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const q = query.q?.trim();
    const digits = q?.replace(/[\s().-]/g, "") ?? "";
    const where: Prisma.CommerceCreditWalletWhereInput = {
      ...(query.ownerType ? { ownerType: query.ownerType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(context.organizationId !== null ? this.scopeWhere(context.organizationId) : {}),
      ...(q
        ? {
            OR: [
              { ownerOrganization: { name: { contains: q, mode: "insensitive" } } },
              { ownerUser: { firstName: { contains: q, mode: "insensitive" } } },
              { ownerUser: { lastName: { contains: q, mode: "insensitive" } } },
              { ownerUser: { email: { contains: q, mode: "insensitive" } } },
              ...(digits ? [{ ownerUser: { phoneE164: { contains: digits } } }] : []),
            ],
          }
        : {}),
    };
    const [total, wallets] = await Promise.all([
      this.prisma.commerceCreditWallet.count({ where }),
      this.prisma.commerceCreditWallet.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: walletOwnerSelect,
      }),
    ]);
    const items = await Promise.all(
      wallets.map(async (wallet) => ({
        ...wallet,
        stats: await this.stats(this.prisma, wallet.id),
      })),
    );
    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // Own wallet for staff: the organisation wallet for a tenant administrator, the
  // user wallet for a counsellor. Created on first use so a purchase or transfer
  // always has a destination.
  public async myWallet(context: AuthContext) {
    const organizationId = context.organizationId;
    if (!organizationId) this.scopeDenied();
    let wallet;
    if (context.role === MembershipRole.ORGANIZATION_ADMIN) {
      wallet = await this.findOrCreateWallet(
        this.prisma,
        context,
        CommerceCreditWalletOwnerType.ORGANIZATION,
        null,
        organizationId,
      );
    } else if (context.role === MembershipRole.COUNSELLOR) {
      wallet = await this.findOrCreateWallet(
        this.prisma,
        context,
        CommerceCreditWalletOwnerType.USER,
        context.userId,
        null,
      );
    } else {
      this.scopeDenied();
    }
    const [stats, recentLedger] = await Promise.all([
      this.stats(this.prisma, wallet.id),
      this.prisma.commerceCreditLedgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        include: ledgerInclude,
      }),
    ]);
    return { wallet, stats, recentLedger };
  }

  // Organisation wallet summary for the central organisation detail view.
  public async organizationWallet(context: AuthContext, organizationId: string) {
    this.assertCentralAdministrator(context);
    if (context.organizationId !== null && context.organizationId !== organizationId)
      this.scopeDenied();
    const wallet = await this.prisma.commerceCreditWallet.findFirst({
      where: {
        ownerType: CommerceCreditWalletOwnerType.ORGANIZATION,
        ownerOrganizationId: organizationId,
        creditType: CommerceCreditType.REPORT_ACCESS,
      },
      include: walletOwnerSelect,
    });
    if (!wallet) return { wallet: null, stats: null, recentLedger: [] };
    const [stats, recentLedger] = await Promise.all([
      this.stats(this.prisma, wallet.id),
      this.prisma.commerceCreditLedgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        include: ledgerInclude,
      }),
    ]);
    return { wallet, stats, recentLedger };
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
        include: ledgerInclude,
      }),
    ]);
    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // Tenant administrators may list the active counsellors of their own
  // organisation as transfer destinations; central administrators name the org.
  public async listCounsellors(context: AuthContext, organizationId?: string) {
    const scoped =
      context.organizationId ?? (this.isCentralAdministrator(context) ? organizationId : undefined);
    if (!scoped) this.scopeDenied();
    if (context.organizationId !== null && organizationId && organizationId !== scoped)
      this.scopeDenied();
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: scoped,
        role: MembershipRole.COUNSELLOR,
        status: MembershipStatus.ACTIVE,
      },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return memberships.map((membership) => membership.user);
  }

  public async allot(context: AuthContext, walletId: string, quantity: number, reference?: string) {
    this.assertCentralAdministrator(context);
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
    this.assertCentralAdministrator(context);
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

  public async setStatus(context: AuthContext, walletId: string, input: WalletStatusDto) {
    this.assertCentralAdministrator(context);
    const wallet = await this.requireWalletInScope(this.prisma, context, walletId);
    if (wallet.status === input.status) return wallet;
    if (wallet.status === CommerceCreditWalletStatus.CLOSED) {
      throw new ConflictException({
        code: "REPORT_CREDIT_WALLET_CLOSED",
        message: "A closed wallet cannot be reopened.",
      });
    }
    if (input.status === CommerceCreditWalletStatus.CLOSED && wallet.currentBalance > 0) {
      throw new ConflictException({
        code: "REPORT_CREDIT_WALLET_HAS_BALANCE",
        message: "Revoke or transfer the remaining balance before closing the wallet.",
      });
    }
    const updated = await this.prisma.commerceCreditWallet.update({
      where: { id: walletId },
      data: { status: input.status },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: wallet.ownerOrganizationId ?? context.organizationId,
        actorUserId: context.userId,
        action: "report.credit.wallet.status_changed",
        entityType: "CommerceCreditWallet",
        entityId: walletId,
        metadata: { from: wallet.status, to: input.status, reason: input.reason ?? null },
      },
    });
    return updated;
  }

  // Atomic organisation -> counsellor transfer. The source is derived from the
  // session for tenant administrators; central administrators name an
  // organisation wallet inside their scope. The counsellor must hold an active
  // COUNSELLOR membership in the source organisation. A transfer id shared by
  // both legs makes replays idempotent and unique at the database level.
  public async transfer(context: AuthContext, input: TransferReportCreditsDto) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) this.invalidQuantity();
    const central = this.isCentralAdministrator(context);
    if (!central && context.role !== MembershipRole.ORGANIZATION_ADMIN) this.scopeDenied();
    const transferId = input.transferKey ?? randomUUID();

    const replay = await this.prisma.commerceCreditLedgerEntry.findFirst({
      where: { transferId, eventType: CommerceCreditLedgerEventType.TRANSFER_OUT },
      select: { walletId: true, quantity: true },
    });

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const source = central
            ? await this.requireWalletInScope(tx, context, this.requireSourceWallet(input))
            : await this.findOrCreateWallet(
                tx,
                context,
                CommerceCreditWalletOwnerType.ORGANIZATION,
                null,
                context.organizationId,
              );
          if (
            source.ownerType !== CommerceCreditWalletOwnerType.ORGANIZATION ||
            !source.ownerOrganizationId
          ) {
            throw new BadRequestException({
              code: "REPORT_CREDIT_TRANSFER_SOURCE_INVALID",
              message: "Credits can only be transferred from an organisation wallet.",
            });
          }
          if (replay) {
            if (replay.walletId !== source.id || replay.quantity !== input.quantity) {
              throw new ConflictException({
                code: "REPORT_CREDIT_TRANSFER_KEY_REUSED",
                message: "This transfer key was already used for a different transfer.",
              });
            }
            return this.transferResult(tx, transferId, false);
          }
          if (source.status !== CommerceCreditWalletStatus.ACTIVE) this.inactiveWallet();

          const membership = await tx.organizationMembership.findFirst({
            where: {
              organizationId: source.ownerOrganizationId,
              userId: input.counsellorUserId,
              role: MembershipRole.COUNSELLOR,
              status: MembershipStatus.ACTIVE,
            },
            select: { id: true },
          });
          if (!membership) {
            throw new ForbiddenException({
              code: "REPORT_CREDIT_TRANSFER_DESTINATION_INVALID",
              message: "The destination must be an active counsellor of the same organisation.",
            });
          }
          const destination = await this.findOrCreateWallet(
            tx,
            context,
            CommerceCreditWalletOwnerType.USER,
            input.counsellorUserId,
            null,
          );
          if (destination.status === CommerceCreditWalletStatus.CLOSED) this.inactiveWallet();

          const debited = await tx.commerceCreditWallet.updateMany({
            where: {
              id: source.id,
              status: CommerceCreditWalletStatus.ACTIVE,
              currentBalance: { gte: input.quantity },
            },
            data: { currentBalance: { decrement: input.quantity } },
          });
          if (debited.count !== 1) {
            throw new ConflictException({
              code: "REPORT_CREDIT_INSUFFICIENT_BALANCE",
              message: "The organisation wallet has insufficient balance for this transfer.",
            });
          }
          const [sourceAfter, destinationAfter] = await Promise.all([
            tx.commerceCreditWallet.findUniqueOrThrow({
              where: { id: source.id },
              select: { currentBalance: true },
            }),
            tx.commerceCreditWallet.update({
              where: { id: destination.id },
              data: { currentBalance: { increment: input.quantity } },
              select: { currentBalance: true },
            }),
          ]);
          const reference = input.reference?.trim() || null;
          const metadata = {
            sourceWalletId: source.id,
            destinationWalletId: destination.id,
            organizationId: source.ownerOrganizationId,
            counsellorUserId: input.counsellorUserId,
          };
          await tx.commerceCreditLedgerEntry.create({
            data: {
              walletId: source.id,
              eventType: CommerceCreditLedgerEventType.TRANSFER_OUT,
              quantity: input.quantity,
              delta: -input.quantity,
              balanceAfter: sourceAfter.currentBalance,
              transferId,
              actorUserId: context.userId,
              reference,
              metadata,
            },
          });
          await tx.commerceCreditLedgerEntry.create({
            data: {
              walletId: destination.id,
              eventType: CommerceCreditLedgerEventType.TRANSFER_IN,
              quantity: input.quantity,
              delta: input.quantity,
              balanceAfter: destinationAfter.currentBalance,
              transferId,
              actorUserId: context.userId,
              reference,
              metadata,
            },
          });
          await tx.auditLog.create({
            data: {
              organizationId: source.ownerOrganizationId,
              actorUserId: context.userId,
              action: "report.credit.transferred",
              entityType: "CommerceCreditWallet",
              entityId: source.id,
              metadata: { ...metadata, transferId, quantity: input.quantity, reference },
            },
          });
          return this.transferResult(tx, transferId, true);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        const existing = await this.prisma.commerceCreditLedgerEntry.findFirst({
          where: { transferId, eventType: CommerceCreditLedgerEventType.TRANSFER_OUT },
          select: { id: true },
        });
        if (existing) return this.transferResult(this.prisma, transferId, false);
        throw new ConflictException({
          code: "REPORT_CREDIT_CONCURRENT_UPDATE",
          message: "The wallet changed concurrently. Please retry.",
        });
      }
      throw error;
    }
  }

  // Legacy administrative consumption route: the principal is the wallet owner,
  // never a caller-chosen identity. Delegates to the derived unlock path.
  public async consumeForAttempt(
    context: AuthContext,
    walletId: string,
    input: ConsumeReportCreditDto,
  ) {
    const wallet = await this.requireWalletInScope(this.prisma, context, walletId);
    const ownerMatches =
      wallet.ownerType === CommerceCreditWalletOwnerType.USER
        ? input.principalType === "USER" && input.principalUserId === wallet.ownerUserId
        : input.principalType === "ORGANIZATION" &&
          input.principalOrganizationId === wallet.ownerOrganizationId;
    if (!ownerMatches) {
      throw new BadRequestException({
        code: "REPORT_CREDIT_PRINCIPAL_MISMATCH",
        message: "The report access principal must own the wallet.",
      });
    }
    const result = await this.unlocks.unlock(context, {
      attemptId: input.attemptId,
      mode: wallet.ownerType === CommerceCreditWalletOwnerType.USER ? "COUNSELLOR" : "ORGANIZATION",
      walletId,
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
    });
    return {
      grant: result.grant,
      ledgerEntry: result.ledgerEntry,
      charged: result.status === "charged",
    };
  }

  public async stats(
    client: PrismaClient | Prisma.TransactionClient,
    walletId: string,
  ): Promise<WalletStats> {
    const [rows, wallet] = await Promise.all([
      client.commerceCreditLedgerEntry.groupBy({
        by: ["eventType"],
        where: { walletId },
        _sum: { quantity: true },
      }),
      client.commerceCreditWallet.findUniqueOrThrow({
        where: { id: walletId },
        select: { currentBalance: true },
      }),
    ]);
    const sum = (type: CommerceCreditLedgerEventType) =>
      rows.find((row) => row.eventType === type)?._sum.quantity ?? 0;
    return {
      purchased: sum(CommerceCreditLedgerEventType.PURCHASE),
      allotted: sum(CommerceCreditLedgerEventType.ADMIN_ALLOTMENT),
      transferredIn: sum(CommerceCreditLedgerEventType.TRANSFER_IN),
      transferredOut: sum(CommerceCreditLedgerEventType.TRANSFER_OUT),
      consumed: sum(CommerceCreditLedgerEventType.CONSUMPTION),
      reversed: sum(CommerceCreditLedgerEventType.REVERSAL),
      revoked: sum(CommerceCreditLedgerEventType.REVOCATION),
      remaining: wallet.currentBalance,
    };
  }

  public async findOrCreateWallet(
    client: PrismaClient | Prisma.TransactionClient,
    context: AuthContext,
    ownerType: CommerceCreditWalletOwnerType,
    ownerUserId: string | null,
    ownerOrganizationId: string | null,
  ) {
    const where = {
      ownerType,
      ownerUserId,
      ownerOrganizationId,
      creditType: CommerceCreditType.REPORT_ACCESS,
    };
    const existing = await client.commerceCreditWallet.findFirst({ where });
    if (existing) return existing;
    try {
      const wallet = await client.commerceCreditWallet.create({ data: where });
      await client.auditLog.create({
        data: {
          organizationId: ownerOrganizationId ?? context.organizationId,
          actorUserId: context.userId,
          action: "report.credit.wallet.created",
          entityType: "CommerceCreditWallet",
          entityId: wallet.id,
          metadata: { ownerType, ownerUserId, ownerOrganizationId },
        },
      });
      return wallet;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const wallet = await client.commerceCreditWallet.findFirst({ where });
        if (wallet) return wallet;
      }
      throw error;
    }
  }

  private async transferResult(
    client: PrismaClient | Prisma.TransactionClient,
    transferId: string,
    transferred: boolean,
  ) {
    const legs = await client.commerceCreditLedgerEntry.findMany({
      where: { transferId },
      orderBy: { delta: "asc" },
    });
    return { transferId, transferred, legs };
  }

  private requireSourceWallet(input: TransferReportCreditsDto): string {
    if (!input.sourceWalletId) {
      throw new BadRequestException({
        code: "REPORT_CREDIT_TRANSFER_SOURCE_REQUIRED",
        message: "sourceWalletId is required for central transfers.",
      });
    }
    return input.sourceWalletId;
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

  private scopeWhere(organizationId: string): Prisma.CommerceCreditWalletWhereInput {
    return {
      OR: [
        { ownerOrganizationId: organizationId },
        {
          ownerUser: {
            memberships: { some: { organizationId, status: MembershipStatus.ACTIVE } },
          },
        },
      ],
    };
  }

  private async requireWalletInScope(
    client: PrismaClient | Prisma.TransactionClient,
    context: AuthContext,
    walletId: string,
    withOwner = false,
  ) {
    const wallet = await client.commerceCreditWallet.findFirst({
      where: {
        id: walletId,
        ...(context.organizationId === null ? {} : this.scopeWhere(context.organizationId)),
      },
      ...(withOwner ? { include: walletOwnerSelect } : {}),
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

  private isCentralAdministrator(context: AuthContext): boolean {
    return (
      context.role === MembershipRole.SUPER_ADMIN || context.role === MembershipRole.PLATFORM_ADMIN
    );
  }

  // Complimentary allotment/revocation, the wallet directory and status changes
  // are central (platform) operations. Tenant administrators keep wallet
  // visibility, consumption of credits they hold, purchases and transfers to
  // their own counsellors.
  private assertCentralAdministrator(context: AuthContext) {
    if (!this.isCentralAdministrator(context)) {
      throw new ForbiddenException({
        code: "REPORT_CREDIT_ALLOTMENT_CENTRAL_ONLY",
        message: "This report-credit operation is reserved for central platform administrators.",
      });
    }
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
