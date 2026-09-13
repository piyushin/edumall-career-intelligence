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
import { ConsentDocumentType, MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { CsrfGuard } from "../auth/csrf.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ConsentDocumentAdminService } from "./consent-document-admin.service";
import { CreateConsentDocumentDto } from "./consent.types";

@Controller("admin/consent-documents")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.SUPER_ADMIN)
export class ConsentDocumentAdminController {
  public constructor(
    @Inject(ConsentDocumentAdminService)
    private readonly documents: ConsentDocumentAdminService,
  ) {}

  @Get()
  @Header("cache-control", "no-store")
  public list(@Query("type") type?: ConsentDocumentType) {
    return this.documents.list(type);
  }

  @Post()
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public create(@Body() body: CreateConsentDocumentDto) {
    return this.documents.create(body);
  }

  @Post(":id/publish")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public publish(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.documents.publish(id);
  }

  @Post(":id/retire")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public retire(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.documents.retire(id);
  }
}
