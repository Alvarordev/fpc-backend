import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanionLinkDto {
  @IsOptional() @IsBoolean() isPrimaryInformant?: boolean;
  @IsOptional() @IsBoolean() isPrimaryContact?: boolean;
  @IsOptional() @IsBoolean() isCaregiver?: boolean;
  @IsOptional() @IsString() @MaxLength(50) relationship?: string;
}
