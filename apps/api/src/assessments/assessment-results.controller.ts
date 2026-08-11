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
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AssessmentAssignmentOrganizationQueryDto } from "./assessment-assignment-admin.types";
import { AssessmentReportWorkflowService } from "./assessment-report-workflow.service";
import { GenerateAssessmentReportDto } from "./assessment-report-workflow.types";
import { AssessmentResultsService } from "./assessment-results.service";

@Controller("staff/assessment-results")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN, MembershipRole.COUNSELLOR)
export class AssessmentResultsController {
  public constructor(
    @Inject(AssessmentResultsService)
    private readonly results: AssessmentResultsService,
    @Inject(AssessmentReportWorkflowService)
    private readonly reports: AssessmentReportWorkflowService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
  ) {
    return this.results.listResults(context, query.organizationId);
  }

  @Get(":attemptId/report-readiness")
  @Header("cache-control", "no-store")
  public reportReadiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
  ) {
    return this.reports.getReadiness(context, attemptId, query.organizationId);
  }

  @Post(":attemptId/report-snapshot")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public generateReportSnapshot(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
    @Body() body: GenerateAssessmentReportDto,
  ) {
    return this.reports.generate(
      context,
      attemptId,
      body.normGroupId,
      body.interpretationSetId,
      query.organizationId,
    );
  }

  @Get(":attemptId")
  @Header("cache-control", "no-store")
  public get(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
  ) {
    return this.results.getResult(context, attemptId, query.organizationId);
  }
}
