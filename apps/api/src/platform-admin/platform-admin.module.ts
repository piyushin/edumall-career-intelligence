import { Module } from "@nestjs/common";
import { PlatformAdminGovernanceController } from "./platform-admin-governance.controller";
import { PlatformAdminGovernanceService } from "./platform-admin-governance.service";
import { PlatformAdminController } from "./platform-admin.controller";
import { PlatformAdminService } from "./platform-admin.service";
import { PlatformDirectoryController } from "./platform-directory.controller";
import { PlatformDirectoryService } from "./platform-directory.service";

@Module({
  controllers: [
    PlatformAdminController,
    PlatformAdminGovernanceController,
    PlatformDirectoryController,
  ],
  providers: [PlatformAdminService, PlatformAdminGovernanceService, PlatformDirectoryService],
})
export class PlatformAdminModule {}
