import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IdentityDocumentType } from '../../../database/entities/identity-document-type.enum';
import { MatchesIdentityDocumentType } from '../../../shared/identity-document/identity-document.validator';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  primaryPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondaryPhone?: string;

  @ApiPropertyOptional({ enum: IdentityDocumentType })
  @IsOptional()
  @IsIn(Object.values(IdentityDocumentType))
  documentType?: IdentityDocumentType;

  /** Identity document number (DNI, CE or CPP per `documentType`). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @MatchesIdentityDocumentType()
  dni?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasWhatsapp?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export type PatientCreationInput = Omit<CreatePatientDto, 'primaryPhone'> & {
  primaryPhone?: string | null;
};
