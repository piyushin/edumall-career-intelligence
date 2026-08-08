import { Module } from "@nestjs/common";
import { AssessmentController } from "./assessment.controller";
import { AssessmentNormService } from "./assessment-norm.service";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentNormService, AssessmentScoringService, AssessmentService],
})
export class AssessmentModule {}
