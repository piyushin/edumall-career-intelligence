import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateAssessmentDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public code!: string;
}

export class CreateAssessmentVersionDto {
  @IsInt()
  @Min(1)
  public versionNumber!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public edition!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public form!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  public language!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public scoringVersion!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public normVersion!: string;

  @IsString()
  @MinLength(1)
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
  @MaxLength(200)
  public title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public edition?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public form?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  public language?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public scoringVersion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public normVersion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
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
