import { ApiProperty } from '@nestjs/swagger';
import {
  AlertSeverity,
  AlertStatus,
} from '../../../database/entities/alert.entity';

export class AlertResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({
    nullable: true,
    description:
      'Auto-generated on create, e.g. ALT-2026-1001. Null only for legacy rows that predate ticketing.',
  })
  ticketNumber!: string | null;
  @ApiProperty({ format: 'uuid' }) healthCenterId!: string;
  @ApiProperty() healthCenterName!: string;
  @ApiProperty({
    format: 'uuid',
    description: 'Follow-up of the first report',
  })
  followUpId!: string;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty() createdByName!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() patientFullName!: string;
  @ApiProperty({ nullable: true }) patientDni!: string | null;
  @ApiProperty({ nullable: true }) patientPhone!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: AlertStatus }) status!: AlertStatus;
  @ApiProperty({ enum: AlertSeverity }) severity!: AlertSeverity;
  @ApiProperty({ description: 'Code from the alert_category catalog' })
  category!: string;
  @ApiProperty({ nullable: true }) categoryLabel!: string | null;
  @ApiProperty({
    nullable: true,
    description: 'Code from the alert_derivation_entity catalog',
  })
  derivedTo!: string | null;
  @ApiProperty({ nullable: true }) derivedToLabel!: string | null;
  @ApiProperty({ nullable: true }) derivationNotes!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  derivedAt!: Date | null;
  @ApiProperty({ nullable: true }) resolutionNotes!: string | null;
  @ApiProperty({ description: 'Number of linked patient reports' })
  reportsCount!: number;
  @ApiProperty({ nullable: true }) aiSummary!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  resolvedAt!: Date | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  resolvedByUserId!: string | null;
  @ApiProperty({ nullable: true }) resolvedByName!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
