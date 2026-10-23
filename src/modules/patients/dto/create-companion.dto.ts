import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';
import { CompanionContactRole } from '../../../database/entities/companion-contact-role.enum';

export class CreateCompanionDto extends CreatePatientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryInformant?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @ApiPropertyOptional({ enum: CompanionContactRole, nullable: true })
  @IsOptional()
  @IsIn(Object.values(CompanionContactRole))
  contactRole?: CompanionContactRole | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCaregiver?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;
}
