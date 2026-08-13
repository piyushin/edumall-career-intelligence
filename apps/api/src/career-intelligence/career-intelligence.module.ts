import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessments/assessment.module";
import {
  CAREER_FIT_ALGORITHM_DEFINITIONS,
  CareerFitAlgorithmRegistry,
} from "./career-fit-algorithm.registry";
import { CareerFitExecutionController } from "./career-fit-execution.controller";
import { CareerFitExecutionService } from "./career-fit-execution.service";
import { CareerIntelligenceAdminController } from "./career-intelligence-admin.controller";
import { CareerIntelligenceAdminService } from "./career-intelligence-admin.service";

@Module({
  imports: [AssessmentModule],
  controllers: [CareerIntelligenceAdminController, CareerFitExecutionController],
  providers: [
    {
      provide: CAREER_FIT_ALGORITHM_DEFINITIONS,
      useValue: [],
    },
    CareerFitAlgorithmRegistry,
    CareerFitExecutionService,
    CareerIntelligenceAdminService,
  ],
  exports: [CareerFitAlgorithmRegistry, CareerFitExecutionService],
})
export class CareerIntelligenceModule {}
