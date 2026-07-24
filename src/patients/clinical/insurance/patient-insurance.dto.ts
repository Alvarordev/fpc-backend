import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  EpsProvider,
  InsuranceType,
} from '../../entities/patient-insurance.entity';

export class CreatePatientInsuranceDto {
  @IsUUID() interactionId!: string;
  @IsIn(Object.values(InsuranceType)) insuranceType!: InsuranceType;
  @IsOptional() @IsIn(Object.values(EpsProvider)) epsProvider?: EpsProvider;
  @IsOptional() @IsString() changeReason?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
