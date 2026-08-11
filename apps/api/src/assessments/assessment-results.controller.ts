import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AssessmentAssignmentOrganizationQueryDto } from "./assessment-assignment-admin.types";
import { AssessmentResultsService } from "./assessment-results.service";

@Controller("staff/assessment-results")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN, MembershipRole.COUNSELLOR)
export class AssessmentResultsController {
  public constructor(
    @Inject(AssessmentResultsService)
    private readonly results: AssessmentResultsService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
  ) {
    return this.results.listResults(context, query.organizationId);
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
