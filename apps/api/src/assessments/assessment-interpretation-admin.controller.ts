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
import { AssessmentInterpretationAdminService } from "./assessment-interpretation-admin.service";
import type {
  CreateAssessmentInterpretationRuleDto,
  CreateAssessmentInterpretationSetDto,
} from "./assessment-interpretation-admin.types";

@Controller("admin/assessments/:definitionId/versions/:versionId/interpretation-sets")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
export class AssessmentInterpretationAdminController {
  public constructor(
    @Inject(AssessmentInterpretationAdminService)
    private readonly interpretationSets: AssessmentInterpretationAdminService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.interpretationSets.listInterpretationSets(context, definitionId, versionId);
  }

  @Post()
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public create(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateAssessmentInterpretationSetDto,
  ) {
    return this.interpretationSets.createInterpretationSet(context, definitionId, versionId, body);
  }

  @Get(":interpretationSetId")
  @Header("cache-control", "no-store")
  public get(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("interpretationSetId", new ParseUUIDPipe()) interpretationSetId: string,
  ) {
    return this.interpretationSets.getInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );
  }

  @Post(":interpretationSetId/rules")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createRule(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("interpretationSetId", new ParseUUIDPipe()) interpretationSetId: string,
    @Body() body: CreateAssessmentInterpretationRuleDto,
  ) {
    return this.interpretationSets.createInterpretationRule(
      context,
      definitionId,
      versionId,
      interpretationSetId,
      body,
    );
  }

  @Get(":interpretationSetId/publication-readiness")
  @Header("cache-control", "no-store")
  public getPublicationReadiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("interpretationSetId", new ParseUUIDPipe()) interpretationSetId: string,
  ) {
    return this.interpretationSets.getPublicationReadiness(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );
  }

  @Post(":interpretationSetId/publish")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public publish(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("interpretationSetId", new ParseUUIDPipe()) interpretationSetId: string,
  ) {
    return this.interpretationSets.publishInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );
  }

  @Post(":interpretationSetId/retire")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public retire(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("interpretationSetId", new ParseUUIDPipe()) interpretationSetId: string,
  ) {
    return this.interpretationSets.retireInterpretationSet(
      context,
      definitionId,
      versionId,
      interpretationSetId,
    );
  }
}
