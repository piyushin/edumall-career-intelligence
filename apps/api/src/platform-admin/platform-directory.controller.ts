import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { PlatformScope } from "../auth/platform-scope.decorator";
import { PrivilegedMutationAuditInterceptor } from "../auth/privileged-mutation-audit.interceptor";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ScopeGuard } from "../auth/scope.guard";
import { SensitiveRead } from "../auth/sensitive-read.decorator";
import { PlatformDirectoryService } from "./platform-directory.service";
import { OrganizationDirectoryQueryDto, UserDirectoryQueryDto } from "./platform-admin.types";

@Controller("admin/platform")
@UseGuards(AuthGuard, RolesGuard, ScopeGuard, PermissionsGuard)
@Roles(MembershipRole.SUPER_ADMIN, MembershipRole.PLATFORM_ADMIN)
@PlatformScope()
@UseInterceptors(PrivilegedMutationAuditInterceptor)
@SensitiveRead()
export class PlatformDirectoryController {
  public constructor(
    @Inject(PlatformDirectoryService) private readonly directory: PlatformDirectoryService,
  ) {}

  @Get("dashboard")
  @Permissions("admin.view")
  @Header("cache-control", "no-store")
  public dashboard(@CurrentAuthContext() context: AuthContext) {
    return this.directory.dashboard(context);
  }

  @Get("organizations")
  @Permissions("organization.view")
  @Header("cache-control", "no-store")
  public organizations(
    @CurrentAuthContext() context: AuthContext,
    @Query() query: OrganizationDirectoryQueryDto,
  ) {
    return this.directory.organizations(context, query);
  }

  @Get("organizations/:id")
  @Permissions("organization.view")
  @Header("cache-control", "no-store")
  public organization(
    @CurrentAuthContext() context: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.directory.organization(context, id);
  }

  @Get("users")
  @Permissions("candidate.view")
  @Header("cache-control", "no-store")
  public users(@CurrentAuthContext() context: AuthContext, @Query() query: UserDirectoryQueryDto) {
    return this.directory.users(context, query);
  }

  @Get("users/:id")
  @Permissions("candidate.view")
  @Header("cache-control", "no-store")
  public user(
    @CurrentAuthContext() context: AuthContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.directory.user(context, id);
  }
}
