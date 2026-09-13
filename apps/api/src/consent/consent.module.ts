import { Module } from "@nestjs/common";
import { ConsentDocumentAdminController } from "./consent-document-admin.controller";
import { ConsentDocumentAdminService } from "./consent-document-admin.service";
import { ConsentController } from "./consent.controller";
import { ConsentService } from "./consent.service";

@Module({
  controllers: [ConsentController, ConsentDocumentAdminController],
  providers: [ConsentDocumentAdminService, ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
