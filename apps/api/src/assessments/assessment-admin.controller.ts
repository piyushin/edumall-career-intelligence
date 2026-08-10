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
  CreateAssessmentConstructDto,
  CreateAssessmentDefinitionDto,
  CreateAssessmentItemDto,
  CreateAssessmentItemConstructDto,
  CreateAssessmentItemOptionDto,
  CreateAssessmentOptionScoreDto,
  CreateAssessmentVersionDto,
  UpdateAssessmentVersionDto,
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
  @Put(":definitionId/versions/:versionId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: UpdateAssessmentVersionDto,
  ) {
    return this.assessments.updateDraftVersion(context, definitionId, versionId, body);
  }
  @Get(":definitionId/versions/:versionId/content")
  @Header("cache-control", "no-store")
  public getVersionContent(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.assessments.getVersionContent(context, definitionId, versionId);
  }

  @Post(":definitionId/versions/:versionId/constructs")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createConstruct(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateAssessmentConstructDto,
  ) {
    return this.assessments.createConstruct(context, definitionId, versionId, body);
  }

  @Post(":definitionId/versions/:versionId/items")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createItem(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateAssessmentItemDto,
  ) {
    return this.assessments.createItem(context, definitionId, versionId, body);
  }

  @Post(":definitionId/versions/:versionId/items/:itemId/options")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createItemOption(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Body() body: CreateAssessmentItemOptionDto,
  ) {
    return this.assessments.createItemOption(context, definitionId, versionId, itemId, body);
  }

  @Post(":definitionId/versions/:versionId/items/:itemId/constructs")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createItemConstructLink(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Body() body: CreateAssessmentItemConstructDto,
  ) {
    return this.assessments.createItemConstructLink(context, definitionId, versionId, itemId, body);
  }

  @Post(":definitionId/versions/:versionId/items/:itemId/options/:optionId/scores")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createOptionScore(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Param("optionId", new ParseUUIDPipe()) optionId: string,
    @Body() body: CreateAssessmentOptionScoreDto,
  ) {
    return this.assessments.createOptionScore(
      context,
      definitionId,
      versionId,
      itemId,
      optionId,
      body,
    );
  }

  @Get(":definitionId/versions/:versionId/publication-readiness")
  @Header("cache-control", "no-store")
  public getPublicationReadiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.assessments.getPublicationReadiness(context, definitionId, versionId);
  }

  @Post(":definitionId/versions/:versionId/publish")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public publishVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.assessments.publishVersion(context, definitionId, versionId);
  }

  @Post(":definitionId/versions/:versionId/retire")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public retireVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("definitionId", new ParseUUIDPipe()) definitionId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.assessments.retireVersion(context, definitionId, versionId);
  }
}
