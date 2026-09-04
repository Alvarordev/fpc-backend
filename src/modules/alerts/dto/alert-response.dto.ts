import { ApiProperty } from '@nestjs/swagger';
import {
  AlertCategory,
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
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
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
  @ApiProperty({ enum: AlertCategory }) category!: AlertCategory;
  @ApiProperty() underReview!: boolean;
  @ApiProperty({ nullable: true }) derivedTo!: string | null;
  @ApiProperty({ nullable: true }) derivationNotes!: string | null;
  @ApiProperty({ nullable: true }) aiSummary!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  resolvedAt!: Date | null;
  @ApiProperty({ format: 'uuid', nullable: true }) resolvedById!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  resolvedByUserId!: string | null;
  @ApiProperty({ nullable: true }) resolvedByName!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
