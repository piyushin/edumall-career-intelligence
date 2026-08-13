import { Module } from "@nestjs/common";
import { AssessmentAssignmentAdminController } from "./assessment-assignment-admin.controller";
import { AssessmentAssignmentAdminService } from "./assessment-assignment-admin.service";
import { AssessmentAdminController } from "./assessment-admin.controller";
import { AssessmentAdminService } from "./assessment-admin.service";
import { AssessmentController } from "./assessment.controller";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentReportCompositionService } from "./assessment-report-composition.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";
import { AssessmentReportPdfService } from "./assessment-report-pdf.service";
import { AssessmentReportWorkflowService } from "./assessment-report-workflow.service";
import { AssessmentResultsController } from "./assessment-results.controller";
import { AssessmentResultsService } from "./assessment-results.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  controllers: [
    AssessmentController,
    AssessmentAdminController,
    AssessmentAssignmentAdminController,
    AssessmentResultsController,
  ],
  providers: [
    AssessmentAdminService,
    AssessmentAssignmentAdminService,
    AssessmentInterpretationService,
    AssessmentNormService,
    AssessmentReportCompositionService,
    AssessmentReportDataService,
    AssessmentReportPdfService,
    AssessmentReportWorkflowService,
    AssessmentResultsService,
    AssessmentScoringService,
    AssessmentService,
  ],
  exports: [AssessmentNormService],
})
export class AssessmentModule {}
