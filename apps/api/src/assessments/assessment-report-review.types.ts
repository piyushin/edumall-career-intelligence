import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { AssessmentReportReleaseStatus } from "@prisma/client";

export class AssessmentReportReviewListQueryDto {
  @IsOptional()
  @IsUUID()
  public organizationId?: string;

  @IsOptional()
  @IsIn(Object.values(AssessmentReportReleaseStatus))
  public status?: AssessmentReportReleaseStatus;
}

export class WithdrawAssessmentReportReleaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public reason!: string;
}

export class CreateAssessmentCounsellorNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  public body!: string;
}
