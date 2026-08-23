import { Module } from "@nestjs/common";
import { CommerceAdminController } from "./commerce-admin.controller";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";

@Module({
  controllers: [CommerceController, CommerceAdminController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
