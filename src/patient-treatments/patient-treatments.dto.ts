import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreatePatientTreatmentDto {
  @IsUUID() interactionId!: string;
  @IsUUID() diagnosisId!: string;
  @IsString() treatmentType!: string;
  @IsOptional() @IsString() treatmentFrequency?: string;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() changeReason?: string;
  @IsOptional() @IsString() notReceivingReason?: string;
  @IsOptional() @IsString() treatmentSituation?: string;
}
