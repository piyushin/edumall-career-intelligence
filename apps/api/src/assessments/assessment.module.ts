import { Module } from "@nestjs/common";
import { AssessmentAssignmentAdminController } from "./assessment-assignment-admin.controller";
import { AssessmentAssignmentAdminService } from "./assessment-assignment-admin.service";
import { AssessmentAdminController } from "./assessment-admin.controller";
import { AssessmentAdminService } from "./assessment-admin.service";
import { AssessmentController } from "./assessment.controller";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";
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
    AssessmentReportDataService,
    AssessmentResultsService,
    AssessmentScoringService,
    AssessmentService,
  ],
})
export class AssessmentModule {}
