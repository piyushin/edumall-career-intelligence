import { Module } from "@nestjs/common";
import { AssessmentInterpretationService } from "../assessments/assessment-interpretation.service";
import { AssessmentReportDataService } from "../assessments/assessment-report-data.service";
import { AssessmentReportPdfService } from "../assessments/assessment-report-pdf.service";
import { CareerIntelligenceModule } from "../career-intelligence/career-intelligence.module";
import { AutomaticReportProcessingService } from "./automatic-report-processing.service";
import { CandidateShortResultService } from "./candidate-short-result.service";
import { CandidateCounsellorAssignmentService } from "./candidate-counsellor-assignment.service";
import { ReportAccessPolicyService } from "./report-access-policy.service";
import { ReportConfigurationService } from "./report-configuration.service";
import { ReportCreditService } from "./report-credit.service";
import {
  AdminReportController,
  CandidateReportController,
  CounsellorAssignmentAdminController,
  CounsellorAssignmentStaffController,
  ReportConfigurationController,
  ReportCreditController,
  StaffReportController,
  StaffReportCreditController,
} from "./report-platform.controller";
import { ReportUnlockService } from "./report-unlock.service";
import { ReportOpenService } from "./report-open.service";
import { ReportSearchService } from "./report-search.service";

@Module({
  imports: [CareerIntelligenceModule],
  controllers: [
    AdminReportController,
    CandidateReportController,
    StaffReportController,
    ReportConfigurationController,
    ReportCreditController,
    StaffReportCreditController,
    CounsellorAssignmentAdminController,
    CounsellorAssignmentStaffController,
  ],
  providers: [
    AssessmentInterpretationService,
    AssessmentReportDataService,
    AssessmentReportPdfService,
    AutomaticReportProcessingService,
    CandidateShortResultService,
    ReportSearchService,
    ReportAccessPolicyService,
    ReportOpenService,
    ReportConfigurationService,
    ReportCreditService,
    ReportUnlockService,
    CandidateCounsellorAssignmentService,
  ],
  exports: [
    AutomaticReportProcessingService,
    CandidateShortResultService,
    ReportAccessPolicyService,
    ReportOpenService,
  ],
})
export class ReportPlatformModule {}
