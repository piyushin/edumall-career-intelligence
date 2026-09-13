import { ConsentAcceptorRole, ConsentDocumentType } from "@prisma/client";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class RecordDateOfBirthDto {
  @IsDateString()
  public dateOfBirth!: string;
}

export class AcceptConsentDocumentDto {
  @IsUUID()
  public consentDocumentId!: string;

  @IsEnum(ConsentAcceptorRole)
  public acceptedByRole!: ConsentAcceptorRole;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public guardianName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  public guardianEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public guardianRelationship?: string;
}

export class CreateConsentDocumentDto {
  @IsEnum(ConsentDocumentType)
  public type!: ConsentDocumentType;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  public version!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  public title!: string;

  @IsString()
  @MinLength(1)
  public bodyText!: string;
}
