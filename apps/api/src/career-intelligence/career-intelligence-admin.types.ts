import { CareerFitFactorDirection } from "@prisma/client";
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
  Min,
  MinLength,
} from "class-validator";

const NON_BLANK = /\S/;

export class CreateCareerTaxonomyDto {
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(120)
  public code!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;
}

export class UpdateCareerTaxonomyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;
}

export class CreateCareerTaxonomyVersionDto {
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(60)
  public version!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(60)
  public edition!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(20)
  public locale!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public sourceReference?: string;

  @IsOptional()
  @IsObject()
  public methodology?: Record<string, unknown>;
}

export class UpdateCareerTaxonomyVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(60)
  public edition?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(20)
  public locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public sourceReference?: string;

  @IsOptional()
  @IsObject()
  public methodology?: Record<string, unknown>;
}

export class CreateCareerClusterDto {
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(120)
  public code!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
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

export class UpdateCareerClusterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  public orderIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;
}

export class CreateCareerPathDto {
  @IsUUID()
  public careerClusterId!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(120)
  public code!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
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

export class UpdateCareerPathDto {
  @IsOptional()
  @IsUUID()
  public careerClusterId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  public orderIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;
}

export class CreateCareerFitModelDto {
  @IsUUID()
  public assessmentVersionId!: string;

  @IsUUID()
  public careerTaxonomyVersionId!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(60)
  public version!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public name!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(120)
  public algorithmKey!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(60)
  public algorithmVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public sourceReference?: string;

  @IsOptional()
  @IsObject()
  public methodology?: Record<string, unknown>;
}

export class UpdateCareerFitModelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(120)
  public algorithmKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(60)
  public algorithmVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public sourceReference?: string;

  @IsOptional()
  @IsObject()
  public methodology?: Record<string, unknown>;
}

export class CreateCareerFitModelFactorDto {
  @IsUUID()
  public careerPathId!: string;

  @IsUUID()
  public assessmentConstructId!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  public weight!: number;

  @IsOptional()
  @IsEnum(CareerFitFactorDirection)
  public direction?: CareerFitFactorDirection;

  @IsInt()
  @Min(0)
  public orderIndex!: number;

  @IsOptional()
  @IsObject()
  public configuration?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public rationale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public sourceReference?: string;
}

export class UpdateCareerFitModelFactorDto {
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  public weight?: number;

  @IsOptional()
  @IsEnum(CareerFitFactorDirection)
  public direction?: CareerFitFactorDirection;

  @IsOptional()
  @IsInt()
  @Min(0)
  public orderIndex?: number;

  @IsOptional()
  @IsObject()
  public configuration?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public rationale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public sourceReference?: string;
}

export class CreateCareerFitRecommendationBandDto {
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(120)
  public code!: string;

  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public label!: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  public lowerBound?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
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

  @IsOptional()
  @IsObject()
  public outputData?: Record<string, unknown>;
}

export class UpdateCareerFitRecommendationBandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(NON_BLANK)
  @MaxLength(200)
  public label?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  public lowerBound?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
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

  @IsOptional()
  @IsObject()
  public outputData?: Record<string, unknown>;
}
