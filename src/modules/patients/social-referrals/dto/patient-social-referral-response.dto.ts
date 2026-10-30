import { ApiProperty } from '@nestjs/swagger';
import {
  PatientSocialReferral,
  SocialReferralStatus,
  SocialReferralType,
} from '../../../../database/entities/patient-social-referral.entity';
import { PatientSocialReferralUpdate } from '../../../../database/entities/patient-social-referral-update.entity';

export class PatientSocialReferralUpdateResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) referralId!: string;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty() outcome!: string;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ format: 'uuid' }) authorId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;

  static from(
    update: PatientSocialReferralUpdate,
  ): PatientSocialReferralUpdateResponseDto {
    return {
      id: update.id,
      referralId: update.referralId,
      followUpId: update.followUpId,
      outcome: update.outcome,
      note: update.note,
      authorId: update.authorId,
      createdAt: update.createdAt.toISOString(),
    };
  }
}

export class PatientSocialReferralResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ enum: SocialReferralType }) type!: SocialReferralType;
  @ApiProperty({ type: String, nullable: true })
  complaintChannel!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  healthCenterId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  healthCenterName!: string | null;
  @ApiProperty({ type: String, nullable: true }) issue!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty({ enum: SocialReferralStatus }) status!: SocialReferralStatus;
  @ApiProperty({ format: 'date' }) openedAt!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  closedAt!: string | null;
  @ApiProperty({ format: 'uuid' }) followUpId!: string;
  @ApiProperty({ format: 'uuid' }) createdById!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({
    type: PatientSocialReferralUpdateResponseDto,
    isArray: true,
    description: 'Outcome history, newest first.',
  })
  updates!: PatientSocialReferralUpdateResponseDto[];

  static from(
    referral: PatientSocialReferral,
  ): PatientSocialReferralResponseDto {
    return {
      id: referral.id,
      patientId: referral.patientId,
      type: referral.type,
      complaintChannel: referral.complaintChannel,
      healthCenterId: referral.healthCenterId,
      healthCenterName: referral.healthCenter?.name ?? null,
      issue: referral.issue,
      note: referral.note,
      status: referral.status,
      openedAt: referral.openedAt,
      closedAt: referral.closedAt,
      followUpId: referral.followUpId,
      createdById: referral.createdById,
      createdAt: referral.createdAt.toISOString(),
      updates: [...(referral.updates ?? [])]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((update) => PatientSocialReferralUpdateResponseDto.from(update)),
    };
  }
}
