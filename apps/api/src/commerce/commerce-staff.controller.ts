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
import { CommercePricingService } from "./commerce-pricing.service";
import { CommerceService } from "./commerce.service";
import {
  CreateStaffOrderDto,
  SetCounsellorFeeDto,
  SubmitManualPaymentDto,
  VerifyRazorpayPaymentDto,
} from "./commerce.types";

// Staff self-service commerce: counsellor fee pricing (counsellors only) and
// report-credit pack purchase for tenant administrators and counsellors. The
// purchaser, wallet, price and tax are derived from the session; the same
// order, gateway, webhook, manual-payment and fulfilment services as candidate
// checkout are used.
@Controller("staff/commerce")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.ORGANIZATION_ADMIN, MembershipRole.COUNSELLOR)
export class CommerceStaffController {
  public constructor(
    @Inject(CommercePricingService) private readonly pricing: CommercePricingService,
    @Inject(CommerceService) private readonly commerce: CommerceService,
  ) {}

  @Get("counselling-fees")
  @Roles(MembershipRole.COUNSELLOR)
  @Header("cache-control", "private, no-store")
  public fees(@CurrentAuthContext() context: AuthContext) {
    return this.pricing.getCounsellorFees(context);
  }

  @Put("counselling-fees")
  @Roles(MembershipRole.COUNSELLOR)
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public setFee(@CurrentAuthContext() context: AuthContext, @Body() body: SetCounsellorFeeDto) {
    return this.pricing.setCounsellorFee(context, body);
  }

  @Get("credit-packs")
  @Header("cache-control", "private, no-store")
  public creditPacks(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listStaffCreditPacks(context);
  }

  @Get("orders")
  @Header("cache-control", "private, no-store")
  public orders(@CurrentAuthContext() context: AuthContext) {
    return this.commerce.listStaffOrders(context);
  }

  @Post("orders")
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public createOrder(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: CreateStaffOrderDto,
  ) {
    return this.commerce.createStaffOrder(context, body);
  }

  @Post("orders/:orderId/payment-intent")
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public paymentIntent(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
  ) {
    return this.commerce.createRazorpayPaymentIntent(context, orderId);
  }

  @Post("payments/razorpay/verify")
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public verifyRazorpay(
    @CurrentAuthContext() context: AuthContext,
    @Body() body: VerifyRazorpayPaymentDto,
  ) {
    return this.commerce.verifyRazorpayPayment(context, body);
  }

  @Post("orders/:orderId/manual-payment")
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public manualPayment(
    @CurrentAuthContext() context: AuthContext,
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @Body() body: SubmitManualPaymentDto,
  ) {
    return this.commerce.submitManualPayment(context, orderId, body);
  }
}
