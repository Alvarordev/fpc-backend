import { ApiProperty } from '@nestjs/swagger';
import { EnrollmentFamilyTalkInterest } from '../../../database/entities/enrollment-family-talk-interest.entity';

export class FamilyTalkInterestResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() talkName!: string;
  @ApiProperty() familyMemberName!: string;
  @ApiProperty({ nullable: true }) familyMemberPhone!: string | null;
  @ApiProperty({ nullable: true }) familyMemberEmail!: string | null;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty() patientFullName!: string;
  @ApiProperty({ format: 'uuid' }) enrollmentId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;

  static from(
    interest: EnrollmentFamilyTalkInterest & {
      enrollment: { patientId: string; patient: { fullName: string } };
    },
  ): FamilyTalkInterestResponseDto {
    return {
      id: interest.id,
      talkName: interest.talkName,
      familyMemberName: interest.familyMemberName,
      familyMemberPhone: interest.familyMemberPhone,
      familyMemberEmail: interest.familyMemberEmail,
      patientId: interest.enrollment.patientId,
      patientFullName: interest.enrollment.patient.fullName,
      enrollmentId: interest.enrollmentId,
      createdAt: interest.createdAt,
    };
  }
}

export class FamilyTalkInterestListResponseDto {
  @ApiProperty({ type: FamilyTalkInterestResponseDto, isArray: true })
  data!: FamilyTalkInterestResponseDto[];
  @ApiProperty() total!: number;
}
