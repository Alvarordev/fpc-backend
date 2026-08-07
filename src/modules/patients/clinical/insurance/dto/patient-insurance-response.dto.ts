import { ApiProperty } from '@nestjs/swagger';
import {
  EpsProvider,
  InsuranceType,
  PatientInsurance,
} from '../../../../../database/entities/patient-insurance.entity';

export class PatientInsuranceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty({ enum: InsuranceType })
  insuranceType!: InsuranceType;

  @ApiProperty({ enum: EpsProvider, nullable: true })
  epsProvider!: EpsProvider | null;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty({ nullable: true })
  changeReason!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  startDate!: string | null;

  @ApiProperty({ format: 'date', nullable: true })
  endDate!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(insurance: PatientInsurance): PatientInsuranceResponseDto {
    return {
      id: insurance.id,
      patientId: insurance.patientId,
      followUpId: insurance.followUpId,
      insuranceType: insurance.insuranceType,
      epsProvider: insurance.epsProvider,
      isCurrent: insurance.isCurrent,
      changeReason: insurance.changeReason,
      startDate: insurance.startDate,
      endDate: insurance.endDate,
      createdAt: insurance.createdAt.toISOString(),
    };
  }
}
