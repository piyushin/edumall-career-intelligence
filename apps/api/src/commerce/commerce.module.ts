import { Module } from "@nestjs/common";
import { CommerceAdminController } from "./commerce-admin.controller";
import { CommercePricingService } from "./commerce-pricing.service";
import { CommerceStaffController } from "./commerce-staff.controller";
import { CommerceWebhookController } from "./commerce-webhook.controller";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { OrderFulfilmentService } from "./order-fulfilment.service";
import { RazorpayWebhookService } from "./razorpay-webhook.service";

@Module({
  controllers: [
    CommerceController,
    CommerceAdminController,
    CommerceStaffController,
    CommerceWebhookController,
  ],
  providers: [
    CommerceService,
    CommercePricingService,
    OrderFulfilmentService,
    RazorpayWebhookService,
  ],
  exports: [CommerceService, CommercePricingService, OrderFulfilmentService],
})
export class CommerceModule {}
