import { Module } from "@nestjs/common";
import { AssessmentAssignmentAdminController } from "./assessment-assignment-admin.controller";
import { AssessmentAssignmentAdminService } from "./assessment-assignment-admin.service";
import { AssessmentAdminController } from "./assessment-admin.controller";
import { AssessmentAdminService } from "./assessment-admin.service";
import { AssessmentController } from "./assessment.controller";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";
import { AssessmentReportPipelineService } from "./assessment-report-pipeline.service";
import { AssessmentReportReviewController } from "./assessment-report-review.controller";
import { AssessmentReportReviewService } from "./assessment-report-review.service";
import { AssessmentReportViewService } from "./assessment-report-view.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  controllers: [
    AssessmentController,
    AssessmentAdminController,
    AssessmentAssignmentAdminController,
    AssessmentReportReviewController,
  ],
  providers: [
    AssessmentAdminService,
    AssessmentAssignmentAdminService,
    AssessmentInterpretationService,
    AssessmentNormService,
    AssessmentReportDataService,
    AssessmentReportPipelineService,
    AssessmentReportReviewService,
    AssessmentReportViewService,
    AssessmentScoringService,
    AssessmentService,
  ],
})
export class AssessmentModule {}
