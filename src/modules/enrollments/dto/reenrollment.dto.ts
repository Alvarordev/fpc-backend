import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ENROLLMENT_HEALTH_PHASES,
  PatientHealthPhase,
} from '../../../database/entities/patient-health-phase.enum';
import { PatientHealthSubcategory } from '../../../database/entities/patient-health-subcategory.enum';
import { FollowUpReenrollment } from '../../../database/entities/follow-up-reenrollment.entity';

export class CreateReenrollmentDto {
  @ApiProperty({ description: 'Código del catálogo reenrollment_reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reason!: string;

  @ApiProperty({ description: 'Código del catálogo entry_source' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entrySource!: string;

  @ApiPropertyOptional({ description: 'Código del catálogo entry_sub_source' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entrySubSource?: string;

  @ApiProperty({ enum: ENROLLMENT_HEALTH_PHASES })
  @IsIn(ENROLLMENT_HEALTH_PHASES)
  healthPhase!: PatientHealthPhase;

  @ApiPropertyOptional({ enum: PatientHealthSubcategory })
  @IsOptional()
  @IsIn(Object.values(PatientHealthSubcategory))
  healthSubcategory?: PatientHealthSubcategory;

  @ApiProperty({
    description:
      'El agente revisó teléfono, dirección, seguro y contacto principal (se editan con sus endpoints).',
    example: true,
  })
  @Equals(true, {
    message: 'Confirma que revisaste los datos de contacto del paciente.',
  })
  contactDataConfirmed!: boolean;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReenrollmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() reason!: string;
  @ApiProperty() reasonLabel!: string;
  @ApiProperty() entrySource!: string;
  @ApiPropertyOptional({ nullable: true }) entrySubSource!: string | null;
  @ApiProperty({ enum: PatientHealthPhase }) healthPhase!: PatientHealthPhase;
  @ApiPropertyOptional({ enum: PatientHealthSubcategory, nullable: true })
  healthSubcategory!: PatientHealthSubcategory | null;
  @ApiProperty({ format: 'date-time' }) contactDataConfirmedAt!: Date;
  @ApiPropertyOptional({ nullable: true }) notes!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(
    item: FollowUpReenrollment,
    reasonLabel: string,
  ): ReenrollmentResponseDto {
    return {
      id: item.id,
      followUpId: item.followUpId,
      patientId: item.patientId,
      reason: item.reason,
      reasonLabel,
      entrySource: item.entrySource,
      entrySubSource: item.entrySubSource,
      healthPhase: item.healthPhase,
      healthSubcategory: item.healthSubcategory,
      contactDataConfirmedAt: item.contactDataConfirmedAt,
      notes: item.notes,
      createdById: item.createdById,
      createdAt: item.createdAt,
    };
  }
}
