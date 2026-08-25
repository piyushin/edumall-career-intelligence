import {
  ArrayNotEmpty,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Matches,
} from "class-validator";
import {
  AdminProfileStatus,
  AdminScopeType,
  AssessmentAttemptStatus,
  CommerceEntitlementStatus,
  CommerceOrderStatus,
  MembershipRole,
  OrganizationStatus,
  OrganizationType,
  UserStatus,
} from "@prisma/client";

export class CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(512) cursor?: string;
  @IsOptional() @IsString() @Matches(/^\d{1,3}$/) limit?: string;
}

export class AdminDirectoryQueryDto extends CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsEnum(AdminProfileStatus) status?: AdminProfileStatus;
  @IsOptional() @IsEnum(AdminScopeType) scopeType?: AdminScopeType;
  @IsOptional() @IsUUID() organizationId?: string;
}

export class UpdatePlatformAdminDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(200) responsibility?: string;
}

export class RoleTemplateQueryDto extends CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @Matches(/^(true|false)$/) isActive?: string;
  @IsOptional() @Matches(/^(true|false)$/) isSystem?: string;
}

export class OrganizationDirectoryQueryDto extends CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(OrganizationType) type?: OrganizationType;
  @IsOptional() @IsEnum(OrganizationStatus) status?: OrganizationStatus;
}

export class UserDirectoryQueryDto extends CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsEnum(MembershipRole) role?: MembershipRole;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional()
  @IsIn([
    "SCHOOL_6_8",
    "SCHOOL_9_10",
    "SCHOOL_11_12",
    "COLLEGE",
    "PROFESSIONAL",
    "SKILLED_WORKFORCE",
  ])
  candidateSegment?: string;
  @IsOptional() @IsEnum(AssessmentAttemptStatus) assessmentState?: AssessmentAttemptStatus;
  @IsOptional() @IsIn(["RELEASED", "NOT_RELEASED"]) reportState?: "RELEASED" | "NOT_RELEASED";
  @IsOptional() @IsEnum(CommerceOrderStatus) paymentState?: CommerceOrderStatus;
  @IsOptional() @IsEnum(CommerceEntitlementStatus) entitlementState?: CommerceEntitlementStatus;
}

export class CreatePlatformAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 100)
  firstName!: string;

  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsibility?: string;

  @IsString()
  @Length(1, 100)
  roleTemplateCode!: string;

  @IsEnum(AdminScopeType)
  scopeType!: AdminScopeType;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  organizationIds?: string[];
}

export class AssignAdminRoleDto {
  @IsString()
  @Length(1, 100)
  roleTemplateCode!: string;

  @IsEnum(AdminScopeType)
  scopeType!: AdminScopeType;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  organizationIds?: string[];
}
