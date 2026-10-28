import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ReferralStatus,
  ReferralType,
} from '../../../database/entities/referral.entity';

export class CreateReferralDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  originHealthCenterId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  destinationHealthCenterId?: string | null;

  @ApiPropertyOptional({
    description: 'medical_specialty catalog code',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string | null;

  @ApiProperty({ enum: ReferralType })
  @IsEnum(ReferralType)
  type!: ReferralType;

  @ApiPropertyOptional({
    enum: ReferralStatus,
    default: ReferralStatus.REQUESTED,
  })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @ApiProperty({ format: 'date' })
  @IsISO8601({ strict: true })
  requestedOn!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  issuedOn?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  attendedOn?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  viaSepa?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  followUpId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Patient document holding the referral sheet',
  })
  @IsOptional()
  @IsUUID()
  referralSheetDocumentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateReferralDto extends PartialType(CreateReferralDto) {}
