import { ApiProperty } from '@nestjs/swagger';

export class AlertReportResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) alertId!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() patientFullName!: string;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ format: 'date-time' }) reportedAt!: Date;
  @ApiProperty({ format: 'uuid', nullable: true })
  reportedByUserId!: string | null;
  @ApiProperty({ nullable: true }) reportedByEmail!: string | null;
}

export class AlertAffectedPatientDto {
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) dni!: string | null;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) email!: string | null;
}

export class AlertAffectedPatientsResponseDto {
  @ApiProperty({ format: 'uuid' }) alertId!: string;
  @ApiProperty({ format: 'uuid' }) healthCenterId!: string;
  @ApiProperty() healthCenterName!: string;
  @ApiProperty({ type: AlertAffectedPatientDto, isArray: true })
  patients!: AlertAffectedPatientDto[];
  @ApiProperty() subject!: string;
  @ApiProperty({ description: 'Plain text ready to copy (e.g. WhatsApp)' })
  text!: string;
}

export class AlertNotifyPatientsResponseDto {
  @ApiProperty() totalPatients!: number;
  @ApiProperty() withEmail!: number;
  @ApiProperty() sent!: number;
  @ApiProperty() failed!: number;
  @ApiProperty({
    description: 'False when email delivery is not configured',
  })
  emailEnabled!: boolean;
}
