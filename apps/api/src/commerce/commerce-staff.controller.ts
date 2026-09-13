import { Body, Controller, Get, Header, Inject, Put, UseGuards } from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthContext } from "../auth/auth.types";
import { CsrfGuard } from "../auth/csrf.guard";
import { CurrentAuthContext } from "../auth/current-auth-context.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CommercePricingService } from "./commerce-pricing.service";
import { SetCounsellorFeeDto } from "./commerce.types";

// Counsellor self-service pricing: own professional fee on counselling products,
// inside platform bounds, only while the platform enables counsellor pricing.
@Controller("staff/commerce")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.COUNSELLOR)
export class CommerceStaffController {
  public constructor(
    @Inject(CommercePricingService) private readonly pricing: CommercePricingService,
  ) {}

  @Get("counselling-fees")
  @Header("cache-control", "private, no-store")
  public fees(@CurrentAuthContext() context: AuthContext) {
    return this.pricing.getCounsellorFees(context);
  }

  @Put("counselling-fees")
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public setFee(@CurrentAuthContext() context: AuthContext, @Body() body: SetCounsellorFeeDto) {
    return this.pricing.setCounsellorFee(context, body);
  }
}
