import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePatientSocialReferralUpdateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  followUpId!: string;

  @ApiProperty({
    description: 'Code from the outcome catalog of the referral type.',
  })
  @IsString()
  @IsNotEmpty()
  outcome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
