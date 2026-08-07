import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

export class CreateCompanionDto extends CreatePatientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryInformant?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  relationship?: string;
}
