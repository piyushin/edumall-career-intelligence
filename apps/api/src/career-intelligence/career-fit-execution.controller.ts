import {
  Body,
  Controller,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AssessmentAssignmentOrganizationQueryDto } from "../assessments/assessment-assignment-admin.types";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CareerFitExecutionService } from "./career-fit-execution.service";
import { ExecuteCareerFitDto } from "./career-fit-execution.types";

@Controller("staff/career-intelligence")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN, MembershipRole.COUNSELLOR)
export class CareerFitExecutionController {
  public constructor(
    @Inject(CareerFitExecutionService)
    private readonly careerFit: CareerFitExecutionService,
  ) {}

  @Post("attempts/:attemptId/career-fit-runs")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public execute(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
    @Body() body: ExecuteCareerFitDto,
  ) {
    return this.careerFit.executeForAttempt(
      context,
      attemptId,
      body.normGroupId,
      body.careerFitModelId,
      query.organizationId,
    );
  }
}
