import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class SaveAssessmentResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public textValue?: string;

  @IsOptional()
  @IsNumberString()
  @MaxLength(100)
  public numericValue?: string;

  @IsOptional()
  @IsBoolean()
  public booleanValue?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  public optionIds?: string[];
}
