import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class AssessmentAssignmentOrganizationQueryDto {
  @IsOptional()
  @IsUUID()
  public organizationId?: string;
}

export class CreateAssessmentAssignmentDto {
  @IsOptional()
  @IsUUID()
  public organizationId?: string;

  @IsUUID()
  public assessmentVersionId!: string;

  @IsUUID()
  public userId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  public maxAttempts?: number;

  @IsOptional()
  @IsDateString()
  public availableFrom?: string;

  @IsOptional()
  @IsDateString()
  public expiresAt?: string;
}
