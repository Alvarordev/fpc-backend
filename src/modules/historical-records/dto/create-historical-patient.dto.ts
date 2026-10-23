import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreatePatientDto } from '../../patients/dto/create-patient.dto';

export class CreateHistoricalPatientDto extends OmitType(CreatePatientDto, [
  'primaryPhone',
] as const) {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryPhone?: string | null;
}
