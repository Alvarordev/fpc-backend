import { ApiProperty } from '@nestjs/swagger';
import { DoseUnit } from '../../../../../database/entities/dose-unit.enum';
import { MedicationRoute } from '../../../../../database/entities/medication-route.enum';
import { TreatmentMedication } from '../../../../../database/entities/treatment-medication.entity';
import { DurationResponseDto } from '../../../../../shared/duration/duration-response.dto';

export class TreatmentMedicationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) treatmentId!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) doseAmount!: number | null;
  @ApiProperty({ enum: DoseUnit, nullable: true }) doseUnit!: DoseUnit | null;
  @ApiProperty({ nullable: true }) doseDescription!: string | null;
  @ApiProperty({ enum: MedicationRoute, nullable: true })
  route!: MedicationRoute | null;
  @ApiProperty({ type: DurationResponseDto, nullable: true })
  frequency!: DurationResponseDto | null;
  @ApiProperty({ format: 'date', nullable: true }) startDate!: string | null;
  @ApiProperty({ format: 'date', nullable: true }) endDate!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;

  static from(medication: TreatmentMedication): TreatmentMedicationResponseDto {
    return {
      id: medication.id,
      treatmentId: medication.treatmentId,
      patientId: medication.patientId,
      name: medication.name,
      doseAmount:
        medication.doseAmount === null ? null : Number(medication.doseAmount),
      doseUnit: medication.doseUnit,
      doseDescription: medication.doseDescription,
      route: medication.route,
      frequency: DurationResponseDto.from(medication.frequency),
      startDate: medication.startDate,
      endDate: medication.endDate,
      isActive: medication.isActive,
      notes: medication.notes,
      createdAt: medication.createdAt.toISOString(),
    };
  }
}
