import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatientReferral } from '../../../../database/entities/patient-referral.entity';

export class PatientReferralResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) followUpId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) fromHealthCenterId!:
    string | null;
  @ApiPropertyOptional({ nullable: true }) fromHealthCenterName?: string | null;
  @ApiProperty({ format: 'uuid' }) toHealthCenterId!: string;
  @ApiPropertyOptional({ nullable: true }) toHealthCenterName?: string | null;
  @ApiProperty({ nullable: true }) specialty!: string | null;
  @ApiProperty({ nullable: true }) reason!: string | null;
  @ApiProperty({ format: 'date', nullable: true }) referralDate!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() hasReferralSheet!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;

  static from(referral: PatientReferral): PatientReferralResponseDto {
    return {
      id: referral.id,
      patientId: referral.patientId,
      followUpId: referral.followUpId,
      fromHealthCenterId: referral.fromHealthCenterId,
      fromHealthCenterName: referral.fromHealthCenter?.name ?? null,
      toHealthCenterId: referral.toHealthCenterId,
      toHealthCenterName: referral.toHealthCenter?.name ?? null,
      specialty: referral.specialty,
      reason: referral.reason,
      referralDate: referral.referralDate,
      isActive: referral.isActive,
      hasReferralSheet: referral.hasReferralSheet,
      createdAt: referral.createdAt.toISOString(),
    };
  }
}
