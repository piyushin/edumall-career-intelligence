import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
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
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(2000)
  public reason!: string;
}

export class CreateAssessmentCounsellorNoteDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: "must contain at least one non-whitespace character" })
  @MaxLength(10000)
  public body!: string;
}
