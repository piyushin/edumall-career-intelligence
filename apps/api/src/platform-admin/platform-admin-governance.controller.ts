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
import { PlatformAdminGovernanceService } from "./platform-admin-governance.service";
import {
  AdminAuditQueryDto,
  CreateAdminRoleTemplateDto,
  SetAdminRolePermissionsDto,
  UpdateAdminRoleTemplateDto,
} from "./platform-admin-governance.types";

@Controller("admin/platform")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN)
export class PlatformAdminGovernanceController {
  public constructor(
    @Inject(PlatformAdminGovernanceService)
    private readonly governance: PlatformAdminGovernanceService,
  ) {}

  @Post("role-templates")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public createRoleTemplate(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateAdminRoleTemplateDto,
  ) {
    return this.governance.createRoleTemplate(context, body);
  }

  @Put("role-templates/:roleTemplateId")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public updateRoleTemplate(
    @CurrentAuthContext() context: AuthContext,
    @Param("roleTemplateId", new ParseUUIDPipe())
    roleTemplateId: string,
    @Body() body: UpdateAdminRoleTemplateDto,
  ) {
    return this.governance.updateRoleTemplate(context, roleTemplateId, body);
  }

  @Put("role-templates/:roleTemplateId/permissions")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public replacePermissions(
    @CurrentAuthContext() context: AuthContext,
    @Param("roleTemplateId", new ParseUUIDPipe())
    roleTemplateId: string,
    @Body() body: SetAdminRolePermissionsDto,
  ) {
    return this.governance.replacePermissions(context, roleTemplateId, body);
  }

  @Post("role-templates/:roleTemplateId/activate")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public activateRoleTemplate(
    @CurrentAuthContext() context: AuthContext,
    @Param("roleTemplateId", new ParseUUIDPipe())
    roleTemplateId: string,
  ) {
    return this.governance.activateRoleTemplate(context, roleTemplateId);
  }

  @Post("role-templates/:roleTemplateId/deactivate")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public deactivateRoleTemplate(
    @CurrentAuthContext() context: AuthContext,
    @Param("roleTemplateId", new ParseUUIDPipe())
    roleTemplateId: string,
  ) {
    return this.governance.deactivateRoleTemplate(context, roleTemplateId);
  }

  @Get("audit")
  @Header("cache-control", "no-store")
  public audit(@CurrentAuthContext() context: AuthContext, @Query() query: AdminAuditQueryDto) {
    return this.governance.listAuditLogs(context, query);
  }
}
