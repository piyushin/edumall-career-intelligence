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
import { AssessmentReportViewService } from "./assessment-report-view.service";
import { AssessmentService } from "./assessment.service";
import { SaveAssessmentResponseDto } from "./assessment.types";

@Controller("assessments")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.STUDENT, MembershipRole.EMPLOYEE)
export class AssessmentController {
  public constructor(
    @Inject(AssessmentService)
    private readonly assessments: AssessmentService,
    @Inject(AssessmentReportViewService)
    private readonly reportView: AssessmentReportViewService,
    @Inject(AssessmentReportPdfService)
    private readonly reportPdf: AssessmentReportPdfService,
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

  @Get("attempts/:attemptId/report")
  @Header("cache-control", "no-store")
  public getMyReport(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
  ) {
    return this.reportView.getMyReport(context, attemptId);
  }

  @Get("attempts/:attemptId/report/pdf")
  public async getMyReportPdf(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe())
    attemptId: string,
    @Res() response: Response,
  ): Promise<void> {
    const source = await this.reportView.getReleasedReportForPdf(context, attemptId);
    const pdf = await this.reportPdf.render(source);

    response
      .status(200)
      .header("cache-control", "no-store")
      .header("content-type", "application/pdf")
      .header("content-disposition", 'inline; filename="assessment-report.pdf"')
      .header("content-length", pdf.length.toString())
      .send(pdf);
  }
}
