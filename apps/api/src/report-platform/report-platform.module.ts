import { Module } from "@nestjs/common";
import { CandidateCounsellorAssignmentService } from "./candidate-counsellor-assignment.service";
import { ReportAccessPolicyService } from "./report-access-policy.service";
import { ReportConfigurationService } from "./report-configuration.service";
import { ReportCreditService } from "./report-credit.service";
import {
  AdminReportController,
  CounsellorAssignmentAdminController,
  CounsellorAssignmentStaffController,
  ReportConfigurationController,
  ReportCreditController,
  StaffReportController,
} from "./report-platform.controller";
import { ReportOpenService } from "./report-open.service";
import { ReportSearchService } from "./report-search.service";

@Module({
  controllers: [
    AdminReportController,
    StaffReportController,
    ReportConfigurationController,
    ReportCreditController,
    CounsellorAssignmentAdminController,
    CounsellorAssignmentStaffController,
  ],
  providers: [
    ReportSearchService,
    ReportAccessPolicyService,
    ReportOpenService,
    ReportConfigurationService,
    ReportCreditService,
    CandidateCounsellorAssignmentService,
  ],
  exports: [ReportAccessPolicyService, ReportOpenService],
})
export class ReportPlatformModule {}
