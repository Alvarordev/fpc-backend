import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CancerStage } from '../../../../../database/entities/patient-diagnosis.entity';
import { DurationDto } from '../../../../../shared/duration/duration.dto';
export class CreatePatientDiagnosisDto {
  @IsUUID() followUpId!: string;
  @IsString() diagnosis!: string;
  @IsOptional() @IsIn(Object.values(CancerStage)) cancerStage?: CancerStage;
  @IsOptional() @IsDateString() diagnosisDate?: string;
  @IsOptional() @IsDateString() firstSymptomsDate?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsString() diagnosisSpecialty?: string;
  @IsOptional() @IsString() symptomLeadingToCheckup?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  waitTimeForDiagnosis?: DurationDto;
  @IsOptional() @IsBoolean() hasMedicalReport?: boolean;
  @IsOptional() @IsBoolean() isSepaActiveReferral?: boolean;
  @IsOptional() @IsString() changeReason?: string;
}
