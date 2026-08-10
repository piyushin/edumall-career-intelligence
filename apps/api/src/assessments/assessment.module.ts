import { Module } from "@nestjs/common";
import { AssessmentAdminController } from "./assessment-admin.controller";
import { AssessmentAdminService } from "./assessment-admin.service";
import { AssessmentController } from "./assessment.controller";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentReportDataService } from "./assessment-report-data.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  controllers: [AssessmentController, AssessmentAdminController],
  providers: [
    AssessmentAdminService,
    AssessmentInterpretationService,
    AssessmentNormService,
    AssessmentReportDataService,
    AssessmentScoringService,
    AssessmentService,
  ],
})
export class AssessmentModule {}
