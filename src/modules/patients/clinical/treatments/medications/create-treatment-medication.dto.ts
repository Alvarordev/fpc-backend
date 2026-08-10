import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DoseUnit } from '../../../../../database/entities/dose-unit.enum';
import { MedicationRoute } from '../../../../../database/entities/medication-route.enum';
import { DurationDto } from '../../../../../shared/duration/duration.dto';

export class CreateTreatmentMedicationDto {
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsNumber() @Min(0) doseAmount?: number;
  @IsOptional() @IsIn(Object.values(DoseUnit)) doseUnit?: DoseUnit;
  @IsOptional() @IsString() @MaxLength(255) doseDescription?: string;
  @IsOptional() @IsIn(Object.values(MedicationRoute)) route?: MedicationRoute;
  @IsOptional()
  @ValidateNested()
  @Type(() => DurationDto)
  frequency?: DurationDto;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() notes?: string;
}
