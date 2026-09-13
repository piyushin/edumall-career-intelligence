import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import type { Response } from "express";
import { AssessmentReportPdfService } from "../assessments/assessment-report-pdf.service";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PrivilegedMutationAuditInterceptor } from "../auth/privileged-mutation-audit.interceptor";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SensitiveRead } from "../auth/sensitive-read.decorator";
import { CandidateCounsellorAssignmentService } from "./candidate-counsellor-assignment.service";
import { AutomaticReportProcessingService } from "./automatic-report-processing.service";
import { CandidateShortResultService } from "./candidate-short-result.service";
import { ReportConfigurationService } from "./report-configuration.service";
import { ReportAccessPolicyService } from "./report-access-policy.service";
import { ReportCreditService } from "./report-credit.service";
import { ReportOpenService } from "./report-open.service";
import { ReportSearchService } from "./report-search.service";
import { ReportUnlockService } from "./report-unlock.service";
import {
  BulkUnlockDto,
  ConfigureAutomaticReportDto,
  ConsumeReportCreditDto,
  CreateCounsellorAssignmentDto,
  CreateWalletDto,
  CreditLedgerQueryDto,
  CreditQuantityDto,
  ReportSearchQueryDto,
  TransferReportCreditsDto,
  UnlockReportDto,
  WalletSearchQueryDto,
  WalletStatusDto,
} from "./report-platform.types";

const ADMIN_ROLES = [
  MembershipRole.SUPER_ADMIN,
  MembershipRole.PLATFORM_ADMIN,
  MembershipRole.ORGANIZATION_ADMIN,
];
const STAFF_ROLES = [...ADMIN_ROLES, MembershipRole.COUNSELLOR];

@Controller("admin/reports")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(...ADMIN_ROLES)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
@SensitiveRead()
export class AdminReportController {
  public constructor(
    @Inject(ReportSearchService) private readonly search: ReportSearchService,
    @Inject(ReportOpenService) private readonly openReport: ReportOpenService,
    @Inject(AssessmentReportPdfService) private readonly pdf: AssessmentReportPdfService,
    @Inject(AutomaticReportProcessingService)
    private readonly automaticReports: AutomaticReportProcessingService,
    @Inject(ReportAccessPolicyService) private readonly reportAccess: ReportAccessPolicyService,
  ) {}

  @Get()
  @Permissions("report.search")
  @Header("cache-control", "no-store")
  public list(@CurrentAuthContext() context: AuthContext, @Query() query: ReportSearchQueryDto) {
    return this.search.searchAdmin(context, query);
  }

  @Get(":attemptId")
  @Permissions("report.search")
  @Header("cache-control", "no-store")
  public detail(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.search.adminDetail(context, attemptId);
  }

  @Get(":attemptId/full")
  @Permissions("report.view.full")
  @Header("cache-control", "private, no-store")
  public full(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.openReport.open(context, attemptId);
  }

  @Get(":attemptId/report.pdf")
  @Permissions("report.download")
  @Header("cache-control", "private, no-store")
  public async pdfReport(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const opened = await this.openReport.openForDownload(context, attemptId);
    const pdf = await this.pdf.render(opened.report);
    response.setHeader("content-type", "application/pdf");
    response.setHeader(
      "content-disposition",
      `attachment; filename="career-intelligence-report-${attemptId}.pdf"`,
    );
    response.setHeader("content-length", String(pdf.length));
    return new StreamableFile(pdf);
  }

  @Post(":attemptId/retry")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("assessment.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public async retry(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    await this.reportAccess.assertCanRetryAutomaticReport(context, attemptId);
    return this.automaticReports.processSubmittedAttempt(attemptId);
  }
}

@Controller("candidate/assessments")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.STUDENT, MembershipRole.EMPLOYEE)
export class CandidateReportController {
  public constructor(
    @Inject(CandidateShortResultService)
    private readonly shortResults: CandidateShortResultService,
    @Inject(ReportOpenService) private readonly openReport: ReportOpenService,
    @Inject(AssessmentReportPdfService) private readonly pdf: AssessmentReportPdfService,
  ) {}

  @Get(":attemptId/short-result")
  @Header("cache-control", "private, no-store")
  public shortResult(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.shortResults.getOwnShortResult(context, attemptId);
  }

  @Get(":attemptId/detailed-report")
  @Header("cache-control", "private, no-store")
  public detailedReport(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.openReport.open(context, attemptId);
  }

  @Get(":attemptId/detailed-report.pdf")
  @Header("cache-control", "private, no-store")
  public async detailedReportPdf(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const opened = await this.openReport.openForDownload(context, attemptId);
    const pdf = await this.pdf.render(opened.report);
    response.setHeader("content-type", "application/pdf");
    response.setHeader(
      "content-disposition",
      `attachment; filename="career-intelligence-report-${attemptId}.pdf"`,
    );
    response.setHeader("content-length", String(pdf.length));
    return new StreamableFile(pdf);
  }
}

@Controller("staff/reports")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(...STAFF_ROLES)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
@SensitiveRead()
export class StaffReportController {
  public constructor(
    @Inject(ReportSearchService) private readonly search: ReportSearchService,
    @Inject(ReportOpenService) private readonly openReport: ReportOpenService,
  ) {}

  @Get()
  @Permissions("report.search")
  @Header("cache-control", "no-store")
  public list(@CurrentAuthContext() context: AuthContext, @Query() query: ReportSearchQueryDto) {
    return this.search.searchStaff(context, query);
  }

  @Get(":attemptId")
  @Permissions("report.search")
  @Header("cache-control", "no-store")
  public detail(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.search.staffDetail(context, attemptId);
  }

  @Get(":attemptId/full")
  @Permissions("candidate.view")
  @Header("cache-control", "private, no-store")
  public full(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.openReport.open(context, attemptId);
  }
}

@Controller("admin/report-configurations")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(...ADMIN_ROLES)
@Permissions("assessment.manage")
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class ReportConfigurationController {
  public constructor(
    @Inject(ReportConfigurationService) private readonly configurations: ReportConfigurationService,
  ) {}
  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query("assessmentVersionId") assessmentVersionId?: string,
  ) {
    return this.configurations.list(context, assessmentVersionId);
  }
  @Get("readiness/:assessmentVersionId")
  @Header("cache-control", "no-store")
  public readiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("assessmentVersionId", new ParseUUIDPipe()) assessmentVersionId: string,
  ) {
    return this.configurations.readiness(context, assessmentVersionId);
  }
  @Post()
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public create(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: ConfigureAutomaticReportDto,
  ) {
    return this.configurations.configure(context, body);
  }
  @Post(":configurationId/activate")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public activate(
    @CurrentAuthContext() context: AuthContext,
    @Param("configurationId", new ParseUUIDPipe()) id: string,
  ) {
    return this.configurations.activate(context, id);
  }
}

@Controller("admin/report-credits")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(...ADMIN_ROLES)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class ReportCreditController {
  public constructor(
    @Inject(ReportCreditService) private readonly credits: ReportCreditService,
    @Inject(ReportUnlockService) private readonly unlocks: ReportUnlockService,
  ) {}
  @Get("wallets")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("report.credit.view")
  @Header("cache-control", "no-store")
  public searchWallets(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: WalletSearchQueryDto,
  ) {
    return this.credits.searchWallets(context, query);
  }
  @Get("organizations/:organizationId/wallet")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("report.credit.view")
  @Header("cache-control", "no-store")
  public organizationWallet(
    @CurrentAuthContext() context: AuthContext,
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.credits.organizationWallet(context, organizationId);
  }
  @Get("counsellors")
  @Permissions("report.credit.view")
  @Header("cache-control", "no-store")
  public counsellors(
    @CurrentAuthContext() context: AuthContext,
    @Query("organizationId") organizationId?: string,
  ) {
    return this.credits.listCounsellors(context, organizationId);
  }
  @Post("wallets")
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public wallet(@CurrentAuthContext() context: AuthContext, @Body() body: CreateWalletDto) {
    return this.credits.createOrGetWallet(context, body);
  }
  @Get("wallets/:walletId")
  @Permissions("report.credit.view")
  @Header("cache-control", "no-store")
  public getWallet(
    @CurrentAuthContext() context: AuthContext,
    @Param("walletId", new ParseUUIDPipe()) id: string,
  ) {
    return this.credits.getWallet(context, id);
  }
  @Get("wallets/:walletId/ledger")
  @Permissions("report.credit.view")
  @Header("cache-control", "no-store")
  public ledger(
    @CurrentAuthContext() context: AuthContext,
    @Param("walletId", new ParseUUIDPipe()) id: string,
    @Query() query: CreditLedgerQueryDto,
  ) {
    return this.credits.ledger(context, id, query.page, query.pageSize);
  }
  @Post("wallets/:walletId/allot")
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public allot(
    @CurrentAuthContext() context: AuthContext,
    @Param("walletId", new ParseUUIDPipe()) id: string,
    @Body() body: CreditQuantityDto,
  ) {
    return this.credits.allot(context, id, body.quantity, body.reference);
  }
  @Post("wallets/:walletId/revoke-unused")
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public revoke(
    @CurrentAuthContext() context: AuthContext,
    @Param("walletId", new ParseUUIDPipe()) id: string,
    @Body() body: CreditQuantityDto,
  ) {
    return this.credits.revokeUnusedAdminCredits(context, id, body.quantity, body.reference);
  }
  @Post("wallets/:walletId/consume")
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public consume(
    @CurrentAuthContext() context: AuthContext,
    @Param("walletId", new ParseUUIDPipe()) id: string,
    @Body() body: ConsumeReportCreditDto,
  ) {
    return this.credits.consumeForAttempt(context, id, body);
  }
  @Post("wallets/:walletId/status")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public status(
    @CurrentAuthContext() context: AuthContext,
    @Param("walletId", new ParseUUIDPipe()) id: string,
    @Body() body: WalletStatusDto,
  ) {
    return this.credits.setStatus(context, id, body);
  }
  // Central transfer inside scope; the body names the organisation wallet.
  @Post("transfers")
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public transfer(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: TransferReportCreditsDto,
  ) {
    return this.credits.transfer(context, body);
  }
  @Post("unlock")
  @Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public unlock(@CurrentAuthContext() context: AuthContext, @Body() body: UnlockReportDto) {
    return this.unlocks.unlock(context, body);
  }
}

// Staff self-service: own wallet, explicit report unlock, bulk unlock and
// organisation -> counsellor transfers. Every principal and wallet is derived
// from the authenticated session; the body only names attempts, mode and
// quantity.
@Controller("staff/report-credits")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(MembershipRole.ORGANIZATION_ADMIN, MembershipRole.COUNSELLOR)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class StaffReportCreditController {
  public constructor(
    @Inject(ReportCreditService) private readonly credits: ReportCreditService,
    @Inject(ReportUnlockService) private readonly unlocks: ReportUnlockService,
  ) {}
  @Get("wallet")
  @Permissions("report.credit.view")
  @Header("cache-control", "private, no-store")
  public wallet(@CurrentAuthContext() context: AuthContext) {
    return this.credits.myWallet(context);
  }
  @Get("counsellors")
  @Roles(MembershipRole.ORGANIZATION_ADMIN)
  @Permissions("report.credit.view")
  @Header("cache-control", "private, no-store")
  public counsellors(@CurrentAuthContext() context: AuthContext) {
    return this.credits.listCounsellors(context);
  }
  @Post("unlock")
  @Permissions("report.credit.view")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "private, no-store")
  public unlock(@CurrentAuthContext() context: AuthContext, @Body() body: UnlockReportDto) {
    return this.unlocks.unlock(context, body);
  }
  @Post("bulk-unlock")
  @Roles(MembershipRole.ORGANIZATION_ADMIN)
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "private, no-store")
  public bulkUnlock(@CurrentAuthContext() context: AuthContext, @Body() body: BulkUnlockDto) {
    return this.unlocks.bulkUnlock(context, body);
  }
  @Post("transfers")
  @Roles(MembershipRole.ORGANIZATION_ADMIN)
  @Permissions("report.credit.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "private, no-store")
  public transfer(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: TransferReportCreditsDto,
  ) {
    return this.credits.transfer(context, body);
  }
}

@Controller("admin/counsellor-assignments")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(...ADMIN_ROLES)
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class CounsellorAssignmentAdminController {
  public constructor(
    @Inject(CandidateCounsellorAssignmentService)
    private readonly assignments: CandidateCounsellorAssignmentService,
  ) {}
  @Get()
  @Permissions("counsellor.assignment.view")
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query("organizationId") organizationId?: string,
  ) {
    return this.assignments.list(context, organizationId);
  }
  @Post()
  @Permissions("counsellor.assignment.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public assign(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCounsellorAssignmentDto,
  ) {
    return this.assignments.assign(context, body);
  }
  @Post(":assignmentId/revoke")
  @Permissions("counsellor.assignment.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public revoke(
    @CurrentAuthContext() context: AuthContext,
    @Param("assignmentId", new ParseUUIDPipe()) id: string,
  ) {
    return this.assignments.revoke(context, id);
  }
}

@Controller("staff/counsellor-assignments")
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles(...STAFF_ROLES)
@Permissions("counsellor.assignment.view")
@UseInterceptors(PrivilegedMutationAuditInterceptor)
@SensitiveRead()
export class CounsellorAssignmentStaffController {
  public constructor(
    @Inject(CandidateCounsellorAssignmentService)
    private readonly assignments: CandidateCounsellorAssignmentService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query("organizationId") organizationId?: string,
  ) {
    return this.assignments.list(context, organizationId);
  }
}
