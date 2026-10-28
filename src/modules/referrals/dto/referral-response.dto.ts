import { ApiProperty } from '@nestjs/swagger';
import {
  HEALTH_CENTER_CARE_LEVELS,
  HEALTH_CENTER_CATEGORIES,
  type HealthCenter,
  type HealthCenterCareLevel,
  type HealthCenterCategory,
} from '../../../database/entities/health-center.entity';
import {
  Referral,
  ReferralStatus,
  ReferralType,
} from '../../../database/entities/referral.entity';

export class ReferralHealthCenterDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() department!: string;
  @ApiProperty({ enum: HEALTH_CENTER_CATEGORIES, nullable: true })
  careCategory!: HealthCenterCategory | null;
  @ApiProperty({ enum: HEALTH_CENTER_CARE_LEVELS, nullable: true })
  careLevel!: HealthCenterCareLevel | null;

  static from(item?: HealthCenter | null): ReferralHealthCenterDto | null {
    if (!item) return null;
    return {
      id: item.id,
      name: item.name,
      department: item.department,
      careCategory: item.careCategory,
      careLevel: item.careLevel,
    };
  }
}

export class ReferralResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) patientId!: string;
  @ApiProperty({ type: ReferralHealthCenterDto, nullable: true })
  originHealthCenter!: ReferralHealthCenterDto | null;
  @ApiProperty({ type: ReferralHealthCenterDto, nullable: true })
  destinationHealthCenter!: ReferralHealthCenterDto | null;
  @ApiProperty({ nullable: true }) specialty!: string | null;
  @ApiProperty({ enum: ReferralType }) type!: ReferralType;
  @ApiProperty({ enum: ReferralStatus }) status!: ReferralStatus;
  @ApiProperty({ format: 'date' }) requestedOn!: string;
  @ApiProperty({ format: 'date', nullable: true }) issuedOn!: string | null;
  @ApiProperty({ format: 'date', nullable: true }) attendedOn!: string | null;
  @ApiProperty() viaSepa!: boolean;
  @ApiProperty({ format: 'uuid', nullable: true }) followUpId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  referralSheetDocumentId!: string | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;

  static from(item: Referral): ReferralResponseDto {
    return {
      id: item.id,
      patientId: item.patientId,
      originHealthCenter: ReferralHealthCenterDto.from(item.originHealthCenter),
      destinationHealthCenter: ReferralHealthCenterDto.from(
        item.destinationHealthCenter,
      ),
      specialty: item.specialty,
      type: item.type,
      status: item.status,
      requestedOn: item.requestedOn,
      issuedOn: item.issuedOn,
      attendedOn: item.attendedOn,
      viaSepa: item.viaSepa,
      followUpId: item.followUpId,
      referralSheetDocumentId: item.referralSheetDocumentId,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
