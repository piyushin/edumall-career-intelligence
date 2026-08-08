import { Module } from "@nestjs/common";
import { AssessmentController } from "./assessment.controller";
import { AssessmentInterpretationService } from "./assessment-interpretation.service";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  controllers: [AssessmentController],
  providers: [
    AssessmentInterpretationService,
    AssessmentNormService,
    AssessmentScoringService,
    AssessmentService,
  ],
})
export class AssessmentModule {}
