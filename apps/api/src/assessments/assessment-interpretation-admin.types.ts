import { AssessmentInterpretationMetric } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateAssessmentInterpretationSetDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public version!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(200)
  public name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public sourceReference?: string;

  @IsOptional()
  @IsObject()
  public methodology?: Record<string, unknown>;
}

export class CreateAssessmentInterpretationRuleDto {
  @IsUUID()
  public assessmentConstructId!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(120)
  public code!: string;

  @IsEnum(AssessmentInterpretationMetric)
  public metric!: AssessmentInterpretationMetric;

  @IsOptional()
  @IsNumber()
  public lowerBound?: number;

  @IsOptional()
  @IsNumber()
  public upperBound?: number;

  @IsOptional()
  @IsBoolean()
  public lowerInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  public upperInclusive?: boolean;

  @IsOptional()
  @IsInt()
  public priority?: number;

  /**
   * Free-form, student-facing content (e.g. { "band": "Strong", "description": "..." }).
   * No shape is enforced here: assessment-report-payload.ts's formatOutputData reads an
   * optional "band" string and otherwise displays the value as-is.
   */
  @IsOptional()
  @IsObject()
  public outputData?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}
