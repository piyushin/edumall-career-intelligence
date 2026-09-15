import { Module } from "@nestjs/common";
import { ConsentModule } from "../consent/consent.module";
import { AssessmentAssignmentAdminController } from "./assessment-assignment-admin.controller";
import { AssessmentAssignmentAdminService } from "./assessment-assignment-admin.service";
import { AssessmentAdminController } from "./assessment-admin.controller";
import { AssessmentAdminService } from "./assessment-admin.service";
import { AssessmentController } from "./assessment.controller";
import { AssessmentInterpretationAdminController } from "./assessment-interpretation-admin.controller";
import { AssessmentInterpretationAdminService } from "./assessment-interpretation-admin.service";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentNormAdminController } from "./assessment-norm-admin.controller";
import { AssessmentNormAdminService } from "./assessment-norm-admin.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";
import { AssessmentReportPdfService } from "./assessment-report-pdf.service";
import { AssessmentReportPipelineService } from "./assessment-report-pipeline.service";
import { AssessmentReportReviewController } from "./assessment-report-review.controller";
import { AssessmentReportReviewService } from "./assessment-report-review.service";
import { AssessmentReportViewService } from "./assessment-report-view.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  imports: [ConsentModule],
  controllers: [
    AssessmentController,
    AssessmentAdminController,
    AssessmentAssignmentAdminController,
    AssessmentInterpretationAdminController,
    AssessmentNormAdminController,
    AssessmentReportReviewController,
  ],
  providers: [
    AssessmentAdminService,
    AssessmentAssignmentAdminService,
    AssessmentInterpretationAdminService,
    AssessmentInterpretationService,
    AssessmentNormAdminService,
    AssessmentNormService,
    AssessmentReportDataService,
    AssessmentReportPdfService,
    AssessmentReportPipelineService,
    AssessmentReportReviewService,
    AssessmentReportViewService,
    AssessmentScoringService,
    AssessmentService,
  ],
})
export class AssessmentModule {}
