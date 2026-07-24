import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';

export class CreateCompanionDto extends CreatePatientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryInformant?: boolean;
}
