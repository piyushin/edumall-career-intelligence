import { AssessmentItemType } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsUUID,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateAssessmentDefinitionDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(120)
  public code!: string;
}

export class CreateAssessmentVersionDto {
  @IsInt()
  @Min(1)
  public versionNumber!: number;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(200)
  public title!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public edition!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public form!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(20)
  public language!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public scoringVersion!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public normVersion!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public reportVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public instructions?: string;
}

export class UpdateAssessmentVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(200)
  public title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public edition?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public form?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(20)
  public language?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public scoringVersion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public normVersion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(60)
  public reportVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public instructions?: string;
}

export class CreateAssessmentConstructDto {
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(120)
  public code!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(200)
  public name!: string;

  @IsInt()
  @Min(0)
  public orderIndex!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;
}

export class CreateAssessmentItemDto {
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(120)
  public code!: string;

  @IsEnum(AssessmentItemType)
  public type!: AssessmentItemType;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(10000)
  public prompt!: string;

  @IsInt()
  @Min(0)
  public orderIndex!: number;

  @IsOptional()
  @IsBoolean()
  public required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public helpText?: string;
}

export class CreateAssessmentItemOptionDto {
  @IsString()
  @MinLength(1)
  @Matches(/\\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(120)
  public code!: string;

  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(5000)
  public label!: string;

  @IsInt()
  @Min(0)
  public orderIndex!: number;
}

export class CreateAssessmentItemConstructDto {
  @IsUUID()
  public constructId!: string;

  @IsOptional()
  @IsNumber()
  public weight?: number;

  @IsOptional()
  @IsBoolean()
  public reverseScored?: boolean;
}

export class CreateAssessmentOptionScoreDto {
  @IsUUID()
  public constructId!: string;

  @IsNumber()
  public score!: number;
}
