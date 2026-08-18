import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AssessmentReportPdfService } from "./assessment-report-pdf.service";
import { AssessmentReportReleaseService } from "./assessment-report-release.service";
import { AssessmentService } from "./assessment.service";
import { SaveAssessmentResponseDto } from "./assessment.types";

@Controller("assessments")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.STUDENT, MembershipRole.EMPLOYEE)
export class AssessmentController {
  public constructor(
    @Inject(AssessmentService)
    private readonly assessments: AssessmentService,
    @Inject(AssessmentReportReleaseService)
    private readonly releases: AssessmentReportReleaseService,
    @Inject(AssessmentReportPdfService)
    private readonly pdf: AssessmentReportPdfService,
  ) {}

  @Get("assignments")
  @Header("cache-control", "no-store")
  public listAssignments(@CurrentAuthContext() context: AuthContext) {
    return this.assessments.listAssignments(context);
  }

  @Post("assignments/:assignmentId/attempts")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public startOrResumeAttempt(
    @CurrentAuthContext() context: AuthContext,
    @Param("assignmentId", new ParseUUIDPipe())
    assignmentId: string,
  ) {
    return this.assessments.startOrResumeAttempt(context, assignmentId);
  }

  @Get("attempts/:attemptId/released-report.pdf")
  @Header("cache-control", "private, no-store")
  public async downloadReleasedReportPdf(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const release = await this.releases.getCandidateReleasedSnapshot(context, attemptId);
    const pdf = await this.pdf.render(release.reportDataSnapshot);

    response.setHeader("content-type", "application/pdf");
    response.setHeader(
      "content-disposition",
      `attachment; filename="career-intelligence-report-${attemptId}.pdf"`,
    );
    response.setHeader("content-length", String(pdf.length));

    return new StreamableFile(pdf);
  }

  @Get("attempts/:attemptId")
  @Header("cache-control", "no-store")
  public getAttempt(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
  ) {
    return this.assessments.getAttempt(context, attemptId);
  }

  @Put("attempts/:attemptId/responses/:itemId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public saveResponse(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
    @Param("itemId", new ParseUUIDPipe())
    itemId: string,
    @Body() body: SaveAssessmentResponseDto,
  ) {
    return this.assessments.saveResponse(context, attemptId, itemId, body);
  }

  @Post("attempts/:attemptId/submit")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public submitAttempt(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
  ) {
    return this.assessments.submitAttempt(context, attemptId);
  }
}
