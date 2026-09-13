import { Module } from "@nestjs/common";
import { CommerceAdminController } from "./commerce-admin.controller";
import { CommerceWebhookController } from "./commerce-webhook.controller";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { OrderFulfilmentService } from "./order-fulfilment.service";
import { RazorpayWebhookService } from "./razorpay-webhook.service";

@Module({
  controllers: [CommerceController, CommerceAdminController, CommerceWebhookController],
  providers: [CommerceService, OrderFulfilmentService, RazorpayWebhookService],
  exports: [CommerceService, OrderFulfilmentService],
})
export class CommerceModule {}
