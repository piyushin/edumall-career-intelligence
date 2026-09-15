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
import { AssessmentNormAdminService } from "./assessment-norm-admin.service";
import type {
  CreateAssessmentConstructNormTableDto,
  CreateAssessmentNormGroupDto,
  CreateAssessmentNormLookupRowDto,
  CreateAssessmentNormSetDto,
} from "./assessment-norm-admin.types";

@Controller("admin/assessments/:definitionId/versions/:versionId/norm-sets")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.ORGANIZATION_ADMIN)
export class AssessmentNormAdminController {
  public constructor(
    @Inject(AssessmentNormAdminService)
    private readonly normSets: AssessmentNormAdminService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.normSets.listNormSets(context, definitionId, versionId);
  }

  @Post()
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public create(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateAssessmentNormSetDto,
  ) {
    return this.normSets.createNormSet(context, definitionId, versionId, body);
  }

  @Get(":normSetId")
  @Header("cache-control", "no-store")
  public get(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
  ) {
    return this.normSets.getNormSet(context, definitionId, versionId, normSetId);
  }

  @Post(":normSetId/groups")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createGroup(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
    @Body() body: CreateAssessmentNormGroupDto,
  ) {
    return this.normSets.createNormGroup(context, definitionId, versionId, normSetId, body);
  }

  @Post(":normSetId/groups/:normGroupId/tables")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createTable(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
    @Param("normGroupId", new ParseUUIDPipe()) normGroupId: string,
    @Body() body: CreateAssessmentConstructNormTableDto,
  ) {
    return this.normSets.createConstructNormTable(
      context,
      definitionId,
      versionId,
      normSetId,
      normGroupId,
      body,
    );
  }

  @Post(":normSetId/groups/:normGroupId/tables/:tableId/rows")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createRow(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
    @Param("normGroupId", new ParseUUIDPipe()) normGroupId: string,
    @Param("tableId", new ParseUUIDPipe()) tableId: string,
    @Body() body: CreateAssessmentNormLookupRowDto,
  ) {
    return this.normSets.createNormLookupRow(
      context,
      definitionId,
      versionId,
      normSetId,
      normGroupId,
      tableId,
      body,
    );
  }

  @Get(":normSetId/publication-readiness")
  @Header("cache-control", "no-store")
  public getPublicationReadiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
  ) {
    return this.normSets.getPublicationReadiness(context, definitionId, versionId, normSetId);
  }

  @Post(":normSetId/publish")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public publish(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
  ) {
    return this.normSets.publishNormSet(context, definitionId, versionId, normSetId);
  }

  @Post(":normSetId/retire")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public retire(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("normSetId", new ParseUUIDPipe()) normSetId: string,
  ) {
    return this.normSets.retireNormSet(context, definitionId, versionId, normSetId);
  }
}
