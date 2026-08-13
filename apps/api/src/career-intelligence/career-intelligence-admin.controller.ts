import {
  Body,
  Controller,
  Delete,
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
import { CareerIntelligenceAdminService } from "./career-intelligence-admin.service";
import {
  CreateCareerClusterDto,
  CreateCareerFitModelDto,
  CreateCareerFitModelFactorDto,
  CreateCareerFitRecommendationBandDto,
  CreateCareerPathDto,
  CreateCareerTaxonomyDto,
  CreateCareerTaxonomyVersionDto,
  UpdateCareerClusterDto,
  UpdateCareerFitModelDto,
  UpdateCareerFitModelFactorDto,
  UpdateCareerFitRecommendationBandDto,
  UpdateCareerPathDto,
  UpdateCareerTaxonomyDto,
  UpdateCareerTaxonomyVersionDto,
} from "./career-intelligence-admin.types";

@Controller("admin/career-intelligence")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN)
export class CareerIntelligenceAdminController {
  public constructor(
    @Inject(CareerIntelligenceAdminService)
    private readonly careerIntelligence: CareerIntelligenceAdminService,
  ) {}

  @Get("taxonomies")
  @Header("cache-control", "no-store")
  public listTaxonomies(@CurrentAuthContext() context: AuthContext) {
    return this.careerIntelligence.listTaxonomies(context);
  }

  @Post("taxonomies")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createTaxonomy(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCareerTaxonomyDto,
  ) {
    return this.careerIntelligence.createTaxonomy(context, body);
  }

  @Put("taxonomies/:taxonomyId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateTaxonomy(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Body() body: UpdateCareerTaxonomyDto,
  ) {
    return this.careerIntelligence.updateTaxonomy(context, taxonomyId, body);
  }

  @Post("taxonomies/:taxonomyId/versions")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createTaxonomyVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Body() body: CreateCareerTaxonomyVersionDto,
  ) {
    return this.careerIntelligence.createTaxonomyVersion(context, taxonomyId, body);
  }

  @Get("taxonomies/:taxonomyId/versions/:versionId")
  @Header("cache-control", "no-store")
  public getTaxonomyVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.careerIntelligence.getTaxonomyVersion(context, taxonomyId, versionId);
  }

  @Put("taxonomies/:taxonomyId/versions/:versionId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateTaxonomyVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: UpdateCareerTaxonomyVersionDto,
  ) {
    return this.careerIntelligence.updateTaxonomyVersion(context, taxonomyId, versionId, body);
  }

  @Post("taxonomies/:taxonomyId/versions/:versionId/clusters")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createCluster(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateCareerClusterDto,
  ) {
    return this.careerIntelligence.createCluster(context, taxonomyId, versionId, body);
  }

  @Put("taxonomies/:taxonomyId/versions/:versionId/clusters/:clusterId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateCluster(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("clusterId", new ParseUUIDPipe()) clusterId: string,
    @Body() body: UpdateCareerClusterDto,
  ) {
    return this.careerIntelligence.updateCluster(context, taxonomyId, versionId, clusterId, body);
  }

  @Delete("taxonomies/:taxonomyId/versions/:versionId/clusters/:clusterId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public deleteCluster(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("clusterId", new ParseUUIDPipe()) clusterId: string,
  ) {
    return this.careerIntelligence.deleteCluster(context, taxonomyId, versionId, clusterId);
  }

  @Post("taxonomies/:taxonomyId/versions/:versionId/paths")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createPath(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Body() body: CreateCareerPathDto,
  ) {
    return this.careerIntelligence.createPath(context, taxonomyId, versionId, body);
  }

  @Put("taxonomies/:taxonomyId/versions/:versionId/paths/:pathId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updatePath(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("pathId", new ParseUUIDPipe()) pathId: string,
    @Body() body: UpdateCareerPathDto,
  ) {
    return this.careerIntelligence.updatePath(context, taxonomyId, versionId, pathId, body);
  }

  @Delete("taxonomies/:taxonomyId/versions/:versionId/paths/:pathId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public deletePath(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Param("pathId", new ParseUUIDPipe()) pathId: string,
  ) {
    return this.careerIntelligence.deletePath(context, taxonomyId, versionId, pathId);
  }

  @Get("taxonomies/:taxonomyId/versions/:versionId/publication-readiness")
  @Header("cache-control", "no-store")
  public taxonomyReadiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.careerIntelligence.getTaxonomyPublicationReadiness(context, taxonomyId, versionId);
  }

  @Post("taxonomies/:taxonomyId/versions/:versionId/publish")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public publishTaxonomyVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.careerIntelligence.publishTaxonomyVersion(context, taxonomyId, versionId);
  }

  @Post("taxonomies/:taxonomyId/versions/:versionId/retire")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public retireTaxonomyVersion(
    @CurrentAuthContext() context: AuthContext,
    @Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string,
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.careerIntelligence.retireTaxonomyVersion(context, taxonomyId, versionId);
  }

  @Get("fit-models")
  @Header("cache-control", "no-store")
  public listFitModels(@CurrentAuthContext() context: AuthContext) {
    return this.careerIntelligence.listFitModels(context);
  }

  @Post("fit-models")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createFitModel(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateCareerFitModelDto,
  ) {
    return this.careerIntelligence.createFitModel(context, body);
  }

  @Get("fit-models/:modelId")
  @Header("cache-control", "no-store")
  public getFitModel(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
  ) {
    return this.careerIntelligence.getFitModel(context, modelId);
  }

  @Put("fit-models/:modelId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateFitModel(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Body() body: UpdateCareerFitModelDto,
  ) {
    return this.careerIntelligence.updateFitModel(context, modelId, body);
  }

  @Post("fit-models/:modelId/factors")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createFitFactor(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Body() body: CreateCareerFitModelFactorDto,
  ) {
    return this.careerIntelligence.createFitFactor(context, modelId, body);
  }

  @Put("fit-models/:modelId/factors/:factorId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateFitFactor(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Param("factorId", new ParseUUIDPipe()) factorId: string,
    @Body() body: UpdateCareerFitModelFactorDto,
  ) {
    return this.careerIntelligence.updateFitFactor(context, modelId, factorId, body);
  }

  @Delete("fit-models/:modelId/factors/:factorId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public deleteFitFactor(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Param("factorId", new ParseUUIDPipe()) factorId: string,
  ) {
    return this.careerIntelligence.deleteFitFactor(context, modelId, factorId);
  }

  @Post("fit-models/:modelId/recommendation-bands")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public createRecommendationBand(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Body() body: CreateCareerFitRecommendationBandDto,
  ) {
    return this.careerIntelligence.createRecommendationBand(context, modelId, body);
  }

  @Put("fit-models/:modelId/recommendation-bands/:bandId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public updateRecommendationBand(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Param("bandId", new ParseUUIDPipe()) bandId: string,
    @Body() body: UpdateCareerFitRecommendationBandDto,
  ) {
    return this.careerIntelligence.updateRecommendationBand(context, modelId, bandId, body);
  }

  @Delete("fit-models/:modelId/recommendation-bands/:bandId")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public deleteRecommendationBand(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
    @Param("bandId", new ParseUUIDPipe()) bandId: string,
  ) {
    return this.careerIntelligence.deleteRecommendationBand(context, modelId, bandId);
  }

  @Get("fit-models/:modelId/publication-readiness")
  @Header("cache-control", "no-store")
  public fitModelReadiness(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
  ) {
    return this.careerIntelligence.getFitModelPublicationReadiness(context, modelId);
  }

  @Post("fit-models/:modelId/publish")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public publishFitModel(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
  ) {
    return this.careerIntelligence.publishFitModel(context, modelId);
  }

  @Post("fit-models/:modelId/retire")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public retireFitModel(
    @CurrentAuthContext() context: AuthContext,
    @Param("modelId", new ParseUUIDPipe()) modelId: string,
  ) {
    return this.careerIntelligence.retireFitModel(context, modelId);
  }
}
