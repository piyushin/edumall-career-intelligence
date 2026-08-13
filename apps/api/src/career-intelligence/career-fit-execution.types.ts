import { IsUUID } from "class-validator";

export class ExecuteCareerFitDto {
  @IsUUID()
  public normGroupId!: string;

  @IsUUID()
  public careerFitModelId!: string;
}
