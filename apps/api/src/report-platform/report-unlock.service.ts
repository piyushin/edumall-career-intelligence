import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AssessmentAttemptStatus,
  AssessmentReportGenerationStatus,
  CandidateCounsellorAssignmentStatus,
  CommerceCreditLedgerEventType,
  CommerceCreditType,
  CommerceCreditWalletOwnerType,
  CommerceCreditWalletStatus,
  CommerceEntitlementStatus,
  CommerceEntitlementType,
  CommerceReportAccessGrantSource,
  CommerceReportAccessGrantStatus,
  CommerceReportPrincipalType,
  MembershipRole,
  MembershipStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import type { BulkUnlockDto, UnlockMode, UnlockReportDto } from "./report-platform.types";

export const BULK_UNLOCK_CAP = 200;

export type UnlockItemStatus = "charged" | "already_granted" | `skipped:${string}`;

export interface UnlockResult {
  attemptId: string;
  mode: UnlockMode;
  status: UnlockItemStatus;
  grant: { id: string } | null;
  entitlement: { id: string } | null;
  ledgerEntry: { id: string } | null;
  balance: number | null;
}

type Wallet = Prisma.CommerceCreditWalletGetPayload<Record<string, never>>;

interface Principal {
  key: string;
  type: "ORGANIZATION" | "USER" | "CANDIDATE";
  organizationId: string | null;
  userId: string | null;
}

// Strict accounting: ONE credit = ONE full-report grant for ONE attempt to ONE
// principal. The principal is never taken from the request; it is derived from
// the authenticated role, the source wallet's owner, the attempt's tenant and
// candidate, and the explicit unlock mode. Every charge appends a ledger entry
// that references the grant or entitlement it paid for, inside one
// SERIALIZABLE transaction, and the (wallet, attempt, principal) ledger key is
// unique so a duplicate can never charge twice.
@Injectable()
export class ReportUnlockService {
  public constructor(@Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient) {}

  public async unlock(context: AuthContext, input: UnlockReportDto): Promise<UnlockResult> {
    const [result] = await this.run(
      context,
      input.mode,
      [input.attemptId],
      input.walletId,
      input.reference,
    );
    return result!;
  }

  public async bulkUnlock(context: AuthContext, input: BulkUnlockDto) {
    if (context.role === MembershipRole.COUNSELLOR) {
      // Bulk counsellor unlock is deliberately deferred; single-attempt only.
      throw new ForbiddenException({
        code: "REPORT_UNLOCK_BULK_NOT_AVAILABLE",
        message: "Bulk unlock is available to organisation administrators only.",
      });
    }
    if (input.mode === "COUNSELLOR") {
      throw new BadRequestException({
        code: "REPORT_UNLOCK_MODE_INVALID",
        message: "Bulk unlock supports organisation access or sponsored candidate access.",
      });
    }
    const attemptIds = Array.from(new Set(input.attemptIds));
    if (attemptIds.length === 0 || attemptIds.length > BULK_UNLOCK_CAP) {
      throw new BadRequestException({
        code: "REPORT_UNLOCK_BULK_SIZE_INVALID",
        message: `Bulk unlock accepts between 1 and ${BULK_UNLOCK_CAP} attempts.`,
      });
    }
    const items = await this.run(context, input.mode, attemptIds, input.walletId, input.reference);
    const summary = { charged: 0, alreadyGranted: 0, skipped: 0 };
    for (const item of items) {
      if (item.status === "charged") summary.charged += 1;
      else if (item.status === "already_granted") summary.alreadyGranted += 1;
      else summary.skipped += 1;
    }
    return { mode: input.mode, items, summary, balance: items.at(-1)?.balance ?? null };
  }

  private async run(
    context: AuthContext,
    mode: UnlockMode,
    attemptIds: string[],
    walletId: string | undefined,
    reference: string | undefined,
  ): Promise<UnlockResult[]> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const wallet = await this.resolveSourceWallet(tx, context, mode, walletId);
          const results: UnlockResult[] = [];
          for (const attemptId of attemptIds) {
            results.push(await this.unlockOne(tx, context, wallet, mode, attemptId, reference));
          }
          return results;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        throw new ConflictException({
          code: "REPORT_UNLOCK_CONCURRENT_UPDATE",
          message: "The wallet or grant changed concurrently. Please retry.",
        });
      }
      throw error;
    }
  }

  // The source wallet is the caller's own wallet for tenant administrators and
  // counsellors; central administrators may name a wallet inside their scope.
  private async resolveSourceWallet(
    tx: Prisma.TransactionClient,
    context: AuthContext,
    mode: UnlockMode,
    walletId: string | undefined,
  ): Promise<Wallet> {
    const central =
      context.role === MembershipRole.SUPER_ADMIN || context.role === MembershipRole.PLATFORM_ADMIN;
    let wallet: Wallet | null = null;
    if (central) {
      if (!walletId) {
        throw new BadRequestException({
          code: "REPORT_UNLOCK_WALLET_REQUIRED",
          message: "walletId is required for central administrators.",
        });
      }
      wallet = await tx.commerceCreditWallet.findFirst({
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
                        some: { organizationId: context.organizationId, status: "ACTIVE" },
                      },
                    },
                  },
                ],
              }),
        },
      });
    } else if (context.role === MembershipRole.ORGANIZATION_ADMIN && context.organizationId) {
      if (mode === "COUNSELLOR")
        this.denied("Organisation administrators cannot spend counsellor credits.");
      wallet = await tx.commerceCreditWallet.findFirst({
        where: {
          ownerType: CommerceCreditWalletOwnerType.ORGANIZATION,
          ownerOrganizationId: context.organizationId,
          creditType: CommerceCreditType.REPORT_ACCESS,
        },
      });
    } else if (context.role === MembershipRole.COUNSELLOR && context.organizationId) {
      if (mode !== "COUNSELLOR") this.denied("Counsellors can only unlock reports for themselves.");
      wallet = await tx.commerceCreditWallet.findFirst({
        where: {
          ownerType: CommerceCreditWalletOwnerType.USER,
          ownerUserId: context.userId,
          creditType: CommerceCreditType.REPORT_ACCESS,
        },
      });
    } else {
      this.denied("Report unlock is not available to this session.");
    }
    if (!wallet) {
      throw new NotFoundException({
        code: "REPORT_CREDIT_WALLET_NOT_FOUND",
        message: "No report-credit wallet is available for this unlock.",
      });
    }
    const expectedOwner =
      mode === "COUNSELLOR"
        ? CommerceCreditWalletOwnerType.USER
        : CommerceCreditWalletOwnerType.ORGANIZATION;
    if (wallet.ownerType !== expectedOwner) {
      throw new BadRequestException({
        code: "REPORT_UNLOCK_WALLET_MISMATCH",
        message: "The wallet owner does not match the unlock mode.",
      });
    }
    return wallet;
  }

  private async unlockOne(
    tx: Prisma.TransactionClient,
    context: AuthContext,
    wallet: Wallet,
    mode: UnlockMode,
    attemptId: string,
    reference: string | undefined,
  ): Promise<UnlockResult> {
    const base = {
      attemptId,
      mode,
      grant: null,
      entitlement: null,
      ledgerEntry: null,
      balance: null,
    } satisfies Partial<UnlockResult>;
    const attempt = await tx.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        assignment: { select: { organizationId: true, userId: true, metadata: true } },
        reportGeneration: { select: { status: true } },
      },
    });
    if (!attempt) return { ...base, status: "skipped:ATTEMPT_NOT_FOUND" };

    // Scope: the attempt must belong to the wallet owner's organisation, and a
    // counsellor must be actively assigned to the candidate in that organisation.
    const organizationId = attempt.assignment.organizationId;
    if (
      mode !== "COUNSELLOR" &&
      (wallet.ownerOrganizationId !== organizationId ||
        (context.organizationId !== null && context.organizationId !== organizationId))
    ) {
      return { ...base, status: "skipped:OUT_OF_SCOPE" };
    }
    if (mode === "COUNSELLOR") {
      const counsellorUserId = wallet.ownerUserId!;
      if (context.organizationId !== null && context.organizationId !== organizationId)
        return { ...base, status: "skipped:OUT_OF_SCOPE" };
      const [membership, assignment] = await Promise.all([
        tx.organizationMembership.findFirst({
          where: {
            organizationId,
            userId: counsellorUserId,
            role: MembershipRole.COUNSELLOR,
            status: MembershipStatus.ACTIVE,
          },
          select: { id: true },
        }),
        tx.candidateCounsellorAssignment.findFirst({
          where: {
            organizationId,
            candidateUserId: attempt.assignment.userId,
            counsellorUserId,
            status: CandidateCounsellorAssignmentStatus.ACTIVE,
          },
          select: { id: true },
        }),
      ]);
      if (!membership || !assignment) return { ...base, status: "skipped:CANDIDATE_NOT_ASSIGNED" };
    }
    if (attempt.status !== AssessmentAttemptStatus.SUBMITTED)
      return { ...base, status: "skipped:ATTEMPT_NOT_SUBMITTED" };
    if (attempt.reportGeneration?.status !== AssessmentReportGenerationStatus.GENERATED)
      return { ...base, status: "skipped:REPORT_NOT_GENERATED" };

    const principal = this.principalFor(mode, wallet, attempt.assignment.userId);

    // Idempotency by outcome: an active grant/entitlement for this principal
    // means nothing is charged, whoever created it.
    const existing = await this.findExisting(tx, attemptId, principal);
    if (existing.status === "already_granted") return { ...base, ...existing };
    if (principal.type === "CANDIDATE" && !this.commerceApplies(attempt.assignment.metadata)) {
      return { ...base, status: "skipped:CANDIDATE_ACCESS_NOT_REQUIRED" };
    }
    const priorCharge = await tx.commerceCreditLedgerEntry.findFirst({
      where: {
        walletId: wallet.id,
        attemptId,
        principalKey: principal.key,
        eventType: CommerceCreditLedgerEventType.CONSUMPTION,
      },
      select: { id: true },
    });
    if (priorCharge) return { ...base, status: "already_granted", ledgerEntry: priorCharge };

    if (wallet.status !== CommerceCreditWalletStatus.ACTIVE)
      return { ...base, status: "skipped:WALLET_INACTIVE" };
    const debited = await tx.commerceCreditWallet.updateMany({
      where: {
        id: wallet.id,
        status: CommerceCreditWalletStatus.ACTIVE,
        currentBalance: { gte: 1 },
      },
      data: { currentBalance: { decrement: 1 } },
    });
    if (debited.count !== 1) return { ...base, status: "skipped:INSUFFICIENT_BALANCE" };
    const balance = await tx.commerceCreditWallet.findUniqueOrThrow({
      where: { id: wallet.id },
      select: { currentBalance: true },
    });

    // Create the access object first, then the ledger entry that references it,
    // then back-link the grant so both sides carry evidence of the other.
    let grantId: string | null = null;
    let entitlementId: string | null = null;
    if (principal.type === "CANDIDATE") {
      const entitlement = await tx.commerceEntitlement.upsert({
        where: {
          userId_attemptId_type: {
            userId: principal.userId!,
            attemptId,
            type: CommerceEntitlementType.REPORT,
          },
        },
        create: {
          organizationId,
          userId: principal.userId!,
          attemptId,
          type: CommerceEntitlementType.REPORT,
          status: CommerceEntitlementStatus.ACTIVE,
          source: "TENANT_CREDIT",
          metadata: { sponsoredByWalletId: wallet.id, sponsoredByUserId: context.userId },
        },
        update: {
          status: CommerceEntitlementStatus.ACTIVE,
          source: "TENANT_CREDIT",
          revokedAt: null,
          consumedAt: null,
          metadata: { sponsoredByWalletId: wallet.id, sponsoredByUserId: context.userId },
        },
        select: { id: true },
      });
      entitlementId = entitlement.id;
    } else {
      const grant = await tx.commerceReportAccessGrant.create({
        data: {
          attemptId,
          principalType:
            principal.type === "ORGANIZATION"
              ? CommerceReportPrincipalType.ORGANIZATION
              : CommerceReportPrincipalType.USER,
          principalUserId: principal.type === "USER" ? principal.userId : null,
          principalOrganizationId:
            principal.type === "ORGANIZATION" ? principal.organizationId : null,
          source: CommerceReportAccessGrantSource.CREDIT,
          status: CommerceReportAccessGrantStatus.ACTIVE,
          grantedByUserId: context.userId,
        },
        select: { id: true },
      });
      grantId = grant.id;
    }
    const ledgerEntry = await tx.commerceCreditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        eventType: CommerceCreditLedgerEventType.CONSUMPTION,
        quantity: 1,
        delta: -1,
        balanceAfter: balance.currentBalance,
        attemptId,
        principalKey: principal.key,
        reportAccessGrantId: grantId,
        entitlementId,
        actorUserId: context.userId,
        reference: reference?.trim() || null,
        metadata: { mode, principalType: principal.type },
      },
      select: { id: true },
    });
    if (grantId) {
      await tx.commerceReportAccessGrant.update({
        where: { id: grantId },
        data: { creditLedgerEntryId: ledgerEntry.id },
      });
    }
    await tx.auditLog.create({
      data: {
        organizationId,
        actorUserId: context.userId,
        action: "report.credit.consumed",
        entityType: grantId ? "CommerceReportAccessGrant" : "CommerceEntitlement",
        entityId: grantId ?? entitlementId,
        metadata: {
          walletId: wallet.id,
          ledgerEntryId: ledgerEntry.id,
          attemptId,
          mode,
          principalType: principal.type,
          principalKey: principal.key,
        },
      },
    });
    return {
      ...base,
      status: "charged",
      grant: grantId ? { id: grantId } : null,
      entitlement: entitlementId ? { id: entitlementId } : null,
      ledgerEntry,
      balance: balance.currentBalance,
    };
  }

  private principalFor(mode: UnlockMode, wallet: Wallet, candidateUserId: string): Principal {
    if (mode === "ORGANIZATION") {
      return {
        key: `ORGANIZATION:${wallet.ownerOrganizationId}`,
        type: "ORGANIZATION",
        organizationId: wallet.ownerOrganizationId,
        userId: null,
      };
    }
    if (mode === "COUNSELLOR") {
      return {
        key: `USER:${wallet.ownerUserId}`,
        type: "USER",
        organizationId: null,
        userId: wallet.ownerUserId,
      };
    }
    return {
      key: `CANDIDATE:${candidateUserId}`,
      type: "CANDIDATE",
      organizationId: wallet.ownerOrganizationId,
      userId: candidateUserId,
    };
  }

  private async findExisting(
    tx: Prisma.TransactionClient,
    attemptId: string,
    principal: Principal,
  ): Promise<{
    status: UnlockItemStatus;
    grant: { id: string } | null;
    entitlement: { id: string } | null;
  }> {
    const now = new Date();
    if (principal.type === "CANDIDATE") {
      const entitlement = await tx.commerceEntitlement.findFirst({
        where: {
          attemptId,
          userId: principal.userId!,
          type: CommerceEntitlementType.REPORT,
          status: CommerceEntitlementStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true },
      });
      return entitlement
        ? { status: "already_granted", grant: null, entitlement }
        : { status: "charged", grant: null, entitlement: null };
    }
    const grant = await tx.commerceReportAccessGrant.findFirst({
      where: {
        attemptId,
        principalType:
          principal.type === "ORGANIZATION"
            ? CommerceReportPrincipalType.ORGANIZATION
            : CommerceReportPrincipalType.USER,
        principalUserId: principal.type === "USER" ? principal.userId : null,
        principalOrganizationId:
          principal.type === "ORGANIZATION" ? principal.organizationId : null,
        status: CommerceReportAccessGrantStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    return grant
      ? { status: "already_granted", grant, entitlement: null }
      : { status: "charged", grant: null, entitlement: null };
  }

  private commerceApplies(metadata: unknown): boolean {
    return Boolean(
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).registrationSource === "PUBLIC_SIGNUP",
    );
  }

  private denied(message: string): never {
    throw new ForbiddenException({ code: "REPORT_UNLOCK_DENIED", message });
  }
}
