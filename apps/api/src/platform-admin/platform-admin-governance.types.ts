import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  IsEnum,
} from "class-validator";
import { AuditOutcome } from "@prisma/client";

export class CreateAdminRoleTemplateDto {
  @IsString()
  @Length(2, 100)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class UpdateAdminRoleTemplateDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;
}

export class SetAdminRolePermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class AdminAuditQueryDto {
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsUUID()
  subjectUserId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsEnum(AuditOutcome)
  outcome?: AuditOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/)
  limit?: string;

  /** @deprecated Use limit. Retained through the R19 rollback window. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,3}$/)
  take?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}
