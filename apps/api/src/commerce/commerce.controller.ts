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
import { CommerceService } from "./commerce.service";
import { CreateCandidateOrderDto, VerifyRazorpayPaymentDto } from "./commerce.types";

@Controller("commerce")
@UseGuards(AuthGuard, RolesGuard)
@Roles(MembershipRole.STUDENT, MembershipRole.EMPLOYEE)
export class CommerceController {
  public constructor(
    @Inject(CommerceService)
    private readonly commerce: CommerceService,
  ) {}

  @Get("attempts/:attemptId/checkout")
  @Header("cache-control", "private, no-store")
  public checkout(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
  ) {
    return this.commerce.getCandidateCheckout(context, attemptId);
  }

  @Post("attempts/:attemptId/orders")
  @Header("cache-control", "private, no-store")
  @UseGuards(CsrfGuard)
  public createOrder(
    @CurrentAuthContext() context: AuthContext,
    @Param("attemptId", new ParseUUIDPipe()) attemptId: string,
    @Body() body: CreateCandidateOrderDto,
  ) {
    return this.commerce.createCandidateOrder(context, attemptId, body);
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
}
