import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateAssessmentNormSetDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public normVersion!: string;

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
  public populationMetadata?: Record<string, unknown>;
}

export class CreateAssessmentNormGroupDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(120)
  public code!: string;

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
  @IsObject()
  public criteria?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  public sampleSize?: number;

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}

export class CreateAssessmentConstructNormTableDto {
  @IsUUID()
  public assessmentConstructId!: string;

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}

export class CreateAssessmentNormLookupRowDto {
  @IsNumber()
  public rawScoreMin!: number;

  @IsNumber()
  public rawScoreMax!: number;

  @IsOptional()
  @IsNumber()
  public standardizedScore?: number;

  @IsOptional()
  @IsNumber()
  public percentile?: number;

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>;
}
