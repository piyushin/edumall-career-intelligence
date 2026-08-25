import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PlatformScope } from "../auth/platform-scope.decorator";
import { PrivilegedMutationAuditInterceptor } from "../auth/privileged-mutation-audit.interceptor";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ScopeGuard } from "../auth/scope.guard";
import { PlatformAdminService } from "./platform-admin.service";
import {
  AdminDirectoryQueryDto,
  AssignAdminRoleDto,
  CreatePlatformAdminDto,
  CursorQueryDto,
  RoleTemplateQueryDto,
  UpdatePlatformAdminDto,
} from "./platform-admin.types";

@Controller("admin/platform")
@UseGuards(AuthGuard, RolesGuard, ScopeGuard, PermissionsGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
@PlatformScope()
@UseInterceptors(PrivilegedMutationAuditInterceptor)
export class PlatformAdminController {
  public constructor(
    @Inject(PlatformAdminService)
    private readonly admins: PlatformAdminService,
  ) {}

  @Get("admins")
  @Permissions("admin.view")
  @Header("cache-control", "no-store")
  public listAdmins(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: AdminDirectoryQueryDto,
  ) {
    return this.admins.listAdmins(context, query);
  }

  @Get("admins/:adminProfileId")
  @Permissions("admin.view")
  @Header("cache-control", "no-store")
  public getAdmin(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe()) id: string,
  ) {
    return this.admins.getAdmin(context, id);
  }

  @Get("role-templates")
  @Permissions("admin.view")
  @Header("cache-control", "no-store")
  public listRoleTemplates(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: RoleTemplateQueryDto,
  ) {
    return this.admins.listRoleTemplates(context, query);
  }

  @Get("permissions")
  @Permissions("admin.view")
  @Header("cache-control", "no-store")
  public listPermissions(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: CursorQueryDto,
  ) {
    return this.admins.listPermissions(context, query);
  }

  @Post("admins")
  @Permissions("admin.create")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public createAdmin(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreatePlatformAdminDto,
  ) {
    return this.admins.createAdmin(context, body);
  }

  @Patch("admins/:adminProfileId")
  @Permissions("admin.create")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public updateAdmin(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePlatformAdminDto,
  ) {
    return this.admins.updateAdmin(context, id, body);
  }

  @Post("admins/:adminProfileId/invitation/resend")
  @Permissions("admin.create")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public resendInvitation(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe()) id: string,
  ) {
    return this.admins.resendInvitation(context, id);
  }

  @Post("admins/:adminProfileId/invitation/revoke")
  @Permissions("admin.create")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public revokeInvitation(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe()) id: string,
  ) {
    return this.admins.revokeInvitation(context, id);
  }

  @Post("admins/:adminProfileId/assignments")
  @Permissions("admin.permission.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public assignRole(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe())
    adminProfileId: string,
    @Body() body: AssignAdminRoleDto,
  ) {
    return this.admins.assignRole(context, adminProfileId, body);
  }

  @Post("assignments/:assignmentId/revoke")
  @Permissions("admin.permission.manage")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public revokeAssignment(
    @CurrentAuthContext() context: AuthContext,
    @Param("assignmentId", new ParseUUIDPipe())
    assignmentId: string,
  ) {
    return this.admins.revokeAssignment(context, assignmentId);
  }

  @Post("admins/:adminProfileId/suspend")
  @Permissions("admin.suspend")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public suspend(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe())
    adminProfileId: string,
  ) {
    return this.admins.suspendAdmin(context, adminProfileId);
  }

  @Post("admins/:adminProfileId/reactivate")
  @Permissions("admin.suspend")
  @UseGuards(CsrfGuard)
  @Header("cache-control", "no-store")
  public reactivate(
    @CurrentAuthContext() context: AuthContext,
    @Param("adminProfileId", new ParseUUIDPipe())
    adminProfileId: string,
  ) {
    return this.admins.reactivateAdmin(context, adminProfileId);
  }
}
