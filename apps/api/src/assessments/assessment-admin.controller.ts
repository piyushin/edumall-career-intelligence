import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AssessmentAdminService } from "./assessment-admin.service";
import {
  CreateAssessmentDefinitionDto,
  CreateAssessmentVersionDto,
} from "./assessment-admin.types";

@Controller("admin/assessments")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
export class AssessmentAdminController {
  public constructor(
    @Inject(AssessmentAdminService)
    private readonly assessments: AssessmentAdminService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(@CurrentAuthContext() context: AuthContext) {
    return this.assessments.listDefinitions(context);
  }

  @Get(":definitionId")
  @Header("cache-control", "no-store")
  public get(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
  ) {
    return this.assessments.getDefinition(context, definitionId);
  }

  @Post()
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public create(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateAssessmentDefinitionDto,
  ) {
    return this.assessments.createDefinition(context, body);
  }

  @Post(":definitionId/versions")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Body() body: CreateAssessmentVersionDto,
  ) {
    return this.assessments.createDraftVersion(context, definitionId, body);
  }
}
