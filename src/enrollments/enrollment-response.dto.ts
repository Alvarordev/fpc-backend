import { ApiProperty } from '@nestjs/swagger';
import { AffiliationType } from '../database/entities/enrollment.entity';

export class EnrollmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ enum: AffiliationType }) affiliationType!: AffiliationType;
  @ApiProperty({ format: 'uuid', nullable: true }) companionId!: string | null;
  @ApiProperty({ nullable: true }) currentlyAttendingConsultations!:
    boolean | null;
  @ApiProperty({ nullable: true }) currentlyReceivingTreatment!: boolean | null;
  @ApiProperty({ nullable: true }) entrySource!: string | null;
  @ApiProperty({ nullable: true }) entrySubSource!: string | null;
  @ApiProperty({ nullable: true }) consentToContact!: boolean | null;
  @ApiProperty({ nullable: true }) consentToShareData!: boolean | null;
  @ApiProperty({ nullable: true }) requiresTransportation!: boolean | null;
  @ApiProperty({ nullable: true }) hasMobilityIssues!: boolean | null;
  @ApiProperty() isOncologicalPatient!: boolean;
  @ApiProperty() surveyAccepted!: boolean;
  @ApiProperty({ nullable: true }) caseComments!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  callStartedAt!: Date | null;
  @ApiProperty({ format: 'date-time', nullable: true })
  callEndedAt!: Date | null;
  @ApiProperty({ nullable: true, minimum: 1, maximum: 5 })
  followUpQualityRating!: number | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}
