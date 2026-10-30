import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { SocialReferralType } from '../../../../database/entities/patient-social-referral.entity';

export class CreatePatientSocialReferralDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  followUpId!: string;

  @ApiProperty({ enum: SocialReferralType })
  @IsEnum(SocialReferralType)
  type!: SocialReferralType;

  @ApiPropertyOptional({ description: 'Catalog `complaint_channel` code.' })
  @ValidateIf(
    (dto: CreatePatientSocialReferralDto) =>
      dto.type === SocialReferralType.COMPLAINT,
  )
  @IsString()
  @IsNotEmpty()
  complaintChannel?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf(
    (dto: CreatePatientSocialReferralDto) =>
      dto.type === SocialReferralType.COMPLAINT,
  )
  @IsUUID()
  healthCenterId?: string;

  @ApiPropertyOptional({ description: 'What the complaint is about.' })
  @ValidateIf(
    (dto: CreatePatientSocialReferralDto) =>
      dto.type === SocialReferralType.COMPLAINT,
  )
  @IsString()
  @IsNotEmpty()
  issue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Defaults to today.' })
  @IsOptional()
  @IsDateString()
  openedAt?: string;
}
