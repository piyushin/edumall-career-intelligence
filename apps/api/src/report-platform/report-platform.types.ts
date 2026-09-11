import {
  AssessmentReportConfigurationStatus,
  AssessmentReportGenerationStatus,
  CommerceCreditWalletOwnerType,
  CommerceReportPrincipalType,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class ReportSearchQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() @MaxLength(200) candidateName?: string;
  @IsOptional() @IsString() @MaxLength(32) mobile?: string;
  @IsOptional() @IsString() @MaxLength(320) email?: string;
  @IsOptional() @IsISO8601() submittedDate?: string;
  @IsOptional() @IsISO8601() submittedFrom?: string;
  @IsOptional() @IsISO8601() submittedTo?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsString() @MaxLength(200) tenantName?: string;
  @IsOptional() @IsUUID() assessmentId?: string;
  @IsOptional() @IsUUID() assessmentVersionId?: string;
  @IsOptional()
  @IsEnum(AssessmentReportGenerationStatus)
  generationStatus?: AssessmentReportGenerationStatus;
  @IsOptional()
  @IsIn(["ACTIVE", "CONSUMED", "REVOKED", "NONE"])
  entitlementStatus?: "ACTIVE" | "CONSUMED" | "REVOKED" | "NONE";
  @IsOptional() @IsUUID() counsellorUserId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class ConfigureAutomaticReportDto {
  @IsUUID() assessmentVersionId!: string;
  @IsUUID() normGroupId!: string;
  @IsUUID() interpretationSetId!: string;
  @IsUUID() careerFitModelId!: string;
  @IsString() @MaxLength(60) reportTemplateVersion!: string;
  @IsOptional()
  @IsEnum(AssessmentReportConfigurationStatus)
  status?: AssessmentReportConfigurationStatus;
}

export class CreateWalletDto {
  @IsEnum(CommerceCreditWalletOwnerType) ownerType!: CommerceCreditWalletOwnerType;
  @IsOptional() @IsUUID() ownerUserId?: string;
  @IsOptional() @IsUUID() ownerOrganizationId?: string;
}

export class CreditQuantityDto {
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
}

export class CreditLedgerQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 50;
}

export class ConsumeReportCreditDto {
  @IsUUID() attemptId!: string;
  @IsEnum(CommerceReportPrincipalType) principalType!: CommerceReportPrincipalType;
  @IsOptional() @IsUUID() principalUserId?: string;
  @IsOptional() @IsUUID() principalOrganizationId?: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
}

export class CreateCounsellorAssignmentDto {
  @IsUUID() organizationId!: string;
  @IsUUID() candidateUserId!: string;
  @IsUUID() counsellorUserId!: string;
  @IsOptional() @IsISO8601() consentedAt?: string;
}
