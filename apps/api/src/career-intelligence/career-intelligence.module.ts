import { Module } from "@nestjs/common";
import { AssessmentNormService } from "../assessments/assessment-norm.service";
import {
  CAREER_FIT_ALGORITHM_DEFINITIONS,
  CareerFitAlgorithmRegistry,
} from "./career-fit-algorithm.registry";
import { CareerFitExecutionController } from "./career-fit-execution.controller";
import { CareerFitExecutionService } from "./career-fit-execution.service";
import { CareerIntelligenceAdminController } from "./career-intelligence-admin.controller";
import { CareerIntelligenceAdminService } from "./career-intelligence-admin.service";
import { weightedPercentileCareerFitAlgorithm } from "./weighted-percentile-career-fit.algorithm";
import { weightedScaledRawCareerFitAlgorithm } from "./weighted-scaled-raw-career-fit.algorithm";

@Module({
  controllers: [CareerIntelligenceAdminController, CareerFitExecutionController],
  providers: [
    AssessmentNormService,
    {
      provide: CAREER_FIT_ALGORITHM_DEFINITIONS,
      useValue: [weightedPercentileCareerFitAlgorithm, weightedScaledRawCareerFitAlgorithm],
    },
    CareerFitAlgorithmRegistry,
    CareerFitExecutionService,
    CareerIntelligenceAdminService,
  ],
  exports: [CareerFitAlgorithmRegistry, CareerFitExecutionService],
})
export class CareerIntelligenceModule {}
