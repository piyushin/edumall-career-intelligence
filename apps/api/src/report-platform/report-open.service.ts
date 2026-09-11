import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../auth/auth.types";
import { DATABASE_PRISMA } from "../database/database.tokens";
import { ReportAccessPolicyService } from "./report-access-policy.service";

@Injectable()
export class ReportOpenService {
  public constructor(
    @Inject(DATABASE_PRISMA) private readonly prisma: PrismaClient,
    @Inject(ReportAccessPolicyService) private readonly policy: ReportAccessPolicyService,
  ) {}

  public async open(context: AuthContext, attemptId: string) {
    await this.policy.assertCanOpenFullReport(context, attemptId);
    const attempt = await this.prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        reportGeneration: {
          select: {
            status: true,
            reportDataSnapshot: {
              select: { id: true, reportVersion: true, generatedAt: true, payload: true },
            },
          },
        },
        scoringRuns: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
          select: {
            reportDataSnapshots: {
              orderBy: { generatedAt: "desc" },
              take: 1,
              select: { id: true, reportVersion: true, generatedAt: true, payload: true },
            },
          },
        },
      },
    });
    const snapshot =
      attempt?.reportGeneration?.reportDataSnapshot ??
      attempt?.scoringRuns[0]?.reportDataSnapshots[0];
    if (!snapshot)
      throw new ConflictException({
        code: "ASSESSMENT_REPORT_NOT_GENERATED",
        message: "The complete report is not yet generated.",
      });
    return {
      attemptId,
      generationStatus: attempt?.reportGeneration?.status ?? null,
      report: snapshot,
    };
  }
}
