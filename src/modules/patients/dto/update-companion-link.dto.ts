import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CompanionContactRole } from '../../../database/entities/companion-contact-role.enum';

export class UpdateCompanionLinkDto {
  @IsOptional() @IsBoolean() isPrimaryInformant?: boolean;
  @IsOptional() @IsBoolean() isPrimaryContact?: boolean;
  @IsOptional()
  @IsIn(Object.values(CompanionContactRole))
  contactRole?: CompanionContactRole | null;
  @IsOptional() @IsBoolean() isCaregiver?: boolean;
  @IsOptional() @IsString() @MaxLength(50) relationship?: string;
}
