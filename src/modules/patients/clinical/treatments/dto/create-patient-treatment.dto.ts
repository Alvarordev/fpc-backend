import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CareProgram } from '../../../../../database/entities/care-program.enum';
import { Type } from 'class-transformer';
import { TreatmentSituation } from '../../../../../database/entities/treatment-situation.enum';
import { DurationDto } from '../../../../../shared/duration/duration.dto';
import { CreateTreatmentMedicationDto } from '../medications/create-treatment-medication.dto';

@ValidatorConstraint({ name: 'teleconsultationDetailsWhenDisabled' })
class TeleconsultationDetailsWhenDisabled implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreatePatientTreatmentDto;
    if (dto.receivesTeleconsultation !== false) return true;
    return (
      !dto.teleconsultationNote &&
      (!dto.teleconsultationSpecialties ||
        dto.teleconsultationSpecialties.length === 0)
    );
  }

  defaultMessage(): string {
    return 'teleconsultation details must be empty when receivesTeleconsultation is false';
  }
}

export class CreatePatientTreatmentDto {
  @IsUUID() followUpId!: string;
  @IsUUID() diagnosisId!: string;
  @IsOptional() @IsUUID() seriesId?: string;
  @IsString() treatmentType!: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  treatmentFrequency?: DurationDto;
  @IsOptional() @IsBoolean() isReferred?: boolean;
  @IsOptional() @IsUUID() sourceHealthCenterId?: string;
  @IsOptional() @IsUUID() receivingHealthCenterId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() changeReason?: string;
  @IsOptional() @IsString() notReceivingReason?: string;
  @IsOptional() @IsString() operationName?: string;
  @IsOptional() @IsIn(Object.values(CareProgram)) careProgram?: CareProgram;
  @IsOptional()
  @IsBoolean()
  @Validate(TeleconsultationDetailsWhenDisabled)
  receivesTeleconsultation?: boolean;
  @IsOptional() @IsString() teleconsultationNote?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teleconsultationSpecialties?: string[];
  @IsOptional()
  @IsIn(Object.values(TreatmentSituation))
  treatmentSituation?: TreatmentSituation;
  @ValidateIf(
    (dto: CreatePatientTreatmentDto) =>
      dto.treatmentSituation === TreatmentSituation.ABANDONED,
  )
  @IsString()
  @IsNotEmpty()
  treatmentAbandonmentReason?: string;
  @IsOptional() @IsBoolean() hasLatestPrescription?: boolean;
  @IsOptional() @IsDateString() latestPrescriptionDate?: string;
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateTreatmentMedicationDto)
  medications?: CreateTreatmentMedicationDto[];
}
