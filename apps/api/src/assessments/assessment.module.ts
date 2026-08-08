import { Module } from "@nestjs/common";
import { AssessmentController } from "./assessment.controller";
import { AssessmentScoringService } from "./assessment-scoring.service";
import { AssessmentService } from "./assessment.service";

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentScoringService, AssessmentService],
})
export class AssessmentModule {}
