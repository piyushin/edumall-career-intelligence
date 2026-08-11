import { IsUUID } from "class-validator";

export class GenerateAssessmentReportDto {
  @IsUUID()
  normGroupId!: string;

  @IsUUID()
  interpretationSetId!: string;
}
