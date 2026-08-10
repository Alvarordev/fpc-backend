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
import { TreatmentSituation } from '../../../../../database/entities/treatment-situation.enum';
import { DurationDto } from '../../../../../shared/duration/duration.dto';
import { CreateTreatmentMedicationDto } from '../medications/create-treatment-medication.dto';

export class CreatePatientTreatmentDto {
  @IsUUID() followUpId!: string;
  @IsUUID() diagnosisId!: string;
  @IsOptional() @IsUUID() seriesId?: string;
  @IsString() treatmentType!: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  treatmentFrequency?: DurationDto;
  @IsOptional() @IsUUID() healthCenterId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() changeReason?: string;
  @IsOptional() @IsString() notReceivingReason?: string;
  @IsOptional()
  @IsIn(Object.values(TreatmentSituation))
  treatmentSituation?: TreatmentSituation;
  @IsOptional() @IsBoolean() hasLatestPrescription?: boolean;
  @IsOptional() @IsDateString() latestPrescriptionDate?: string;
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTreatmentMedicationDto)
  medications?: CreateTreatmentMedicationDto[];
}
