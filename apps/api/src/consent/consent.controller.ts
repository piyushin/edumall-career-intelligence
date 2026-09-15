import { Body, Controller, Get, Header, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ConsentService } from "./consent.service";
import { AcceptConsentDocumentDto, RecordDateOfBirthDto } from "./consent.types";

@Controller("consent")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.STUDENT, MembershipRole.EMPLOYEE)
export class ConsentController {
  public constructor(
    @Inject(ConsentService)
    private readonly consent: ConsentService,
  ) {}

  @Get("requirements")
  @Header("cache-control", "no-store")
  public getRequirements(@CurrentAuthContext() context: AuthContext) {
    return this.consent.getRequirements(context.userId);
  }

  @Post("date-of-birth")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public async recordDateOfBirth(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: RecordDateOfBirthDto,
  ) {
    await this.consent.recordDateOfBirth(context.userId, new Date(body.dateOfBirth));

    return this.consent.getRequirements(context.userId);
  }

  @Post("accept")
  @Header("cache-control", "no-store")
  @UseGuards(CsrfGuard)
  public async accept(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: AcceptConsentDocumentDto,
    @Req() request: Request,
  ) {
    await this.consent.acceptConsentDocument(
      context.userId,
      {
        consentDocumentId: body.consentDocumentId,
        acceptedByRole: body.acceptedByRole,
        guardianName: body.guardianName,
        guardianEmail: body.guardianEmail,
        guardianRelationship: body.guardianRelationship,
      },
      request.ip,
    );

    return this.consent.getRequirements(context.userId);
  }
}
