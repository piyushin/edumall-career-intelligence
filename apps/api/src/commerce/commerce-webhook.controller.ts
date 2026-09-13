import {
  BadRequestException,
  Controller,
  Header,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { RazorpayWebhookService } from "./razorpay-webhook.service";

// Provider callbacks carry no session and no CSRF token; authenticity comes
// solely from the HMAC over the raw body, so this controller is deliberately
// outside AuthGuard/CsrfGuard and never returns tenant or candidate data.
@Controller("commerce/webhooks")
export class CommerceWebhookController {
  public constructor(
    @Inject(RazorpayWebhookService) private readonly razorpay: RazorpayWebhookService,
  ) {}

  @Post("razorpay")
  @HttpCode(200)
  @Header("cache-control", "no-store")
  public async razorpayWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Headers("x-razorpay-event-id") eventId: string | undefined,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException({
        code: "PAYMENT_WEBHOOK_BODY_REQUIRED",
        message: "Raw request body is required.",
      });
    }
    const outcome = await this.razorpay.handle(request.rawBody, signature, eventId);
    return { received: true, status: outcome.status };
  }
}
