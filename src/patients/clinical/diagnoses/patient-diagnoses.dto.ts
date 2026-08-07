import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CancerStage } from '../../../database/entities/patient-diagnosis.entity';
export class CreatePatientDiagnosisDto {
  @IsUUID() followUpId!: string;
  @IsString() diagnosis!: string;
  @IsOptional() @IsIn(Object.values(CancerStage)) cancerStage?: CancerStage;
  @IsOptional() @IsDateString() diagnosisDate?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsString() diagnosisSpecialty?: string;
  @IsOptional() @IsString() symptomLeadingToCheckup?: string;
  @IsOptional() @IsString() waitTimeForDiagnosis?: string;
  @IsOptional() @IsBoolean() hasMedicalReport?: boolean;
  @IsOptional() @IsString() changeReason?: string;
}
