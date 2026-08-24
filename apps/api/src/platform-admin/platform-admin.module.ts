import { Module } from "@nestjs/common";
import { PlatformAdminGovernanceController } from "./platform-admin-governance.controller";
import { PlatformAdminGovernanceService } from "./platform-admin-governance.service";
import { PlatformAdminController } from "./platform-admin.controller";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  controllers: [PlatformAdminController, PlatformAdminGovernanceController],
  providers: [PlatformAdminService, PlatformAdminGovernanceService],
})
export class PlatformAdminModule {}
