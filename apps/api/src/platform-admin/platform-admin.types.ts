import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { AdminScopeType } from "@prisma/client";

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
  @ArrayUnique()
  @IsUUID("4", { each: true })
  organizationIds?: string[];
}
