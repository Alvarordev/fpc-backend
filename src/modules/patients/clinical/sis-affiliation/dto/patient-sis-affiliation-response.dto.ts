import { ApiProperty } from '@nestjs/swagger';
import { PatientSisAffiliation } from '../../../../../database/entities/patient-sis-affiliation.entity';

export class PatientSisAffiliationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  patientId!: string;

  @ApiProperty({ format: 'uuid' })
  followUpId!: string;

  @ApiProperty()
  canAffiliate!: boolean;

  @ApiProperty({ nullable: true })
  affiliatedViaSepa!: boolean | null;

  @ApiProperty({ format: 'date', nullable: true })
  expectedDate!: string | null;

  @ApiProperty({ nullable: true })
  cantAffiliateReason!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  affiliatedAt!: string | null;

  @ApiProperty({ nullable: true })
  comments!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from(
    affiliation: PatientSisAffiliation,
  ): PatientSisAffiliationResponseDto {
    return {
      id: affiliation.id,
      patientId: affiliation.patientId,
      followUpId: affiliation.followUpId,
      canAffiliate: affiliation.canAffiliate,
      affiliatedViaSepa: affiliation.affiliatedViaSepa,
      expectedDate: affiliation.expectedDate,
      cantAffiliateReason: affiliation.cantAffiliateReason,
      affiliatedAt: affiliation.affiliatedAt?.toISOString() ?? null,
      comments: affiliation.comments,
      createdAt: affiliation.createdAt.toISOString(),
    };
  }
}
