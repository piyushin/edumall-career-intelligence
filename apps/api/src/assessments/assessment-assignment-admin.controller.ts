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
import { AssessmentAssignmentAdminService } from "./assessment-assignment-admin.service";
import {
  AssessmentAssignmentOrganizationQueryDto,
  CreateAssessmentAssignmentDto,
} from "./assessment-assignment-admin.types";

@Controller("admin/assessment-assignments")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
export class AssessmentAssignmentAdminController {
  public constructor(
    @Inject(AssessmentAssignmentAdminService)
    private readonly assignments: AssessmentAssignmentAdminService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
  ) {
    return this.assignments.listAssignments(context, query.organizationId);
  }

  @Get("candidates")
  @Header("cache-control", "no-store")
  public candidates(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: AssessmentAssignmentOrganizationQueryDto,
  ) {
    return this.assignments.listEligibleCandidates(context, query.organizationId);
  }

  @Post()
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public create(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateAssessmentAssignmentDto,
  ) {
    return this.assignments.createAssignment(context, body);
  }

  @Post(":assignmentId/cancel")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public cancel(
    @CurrentAuthContext() context: AuthContext,
    @Param("assignmentId", new ParseUUIDPipe()) assignmentId: string,
  ) {
    return this.assignments.cancelAssignment(context, assignmentId);
  }
}
