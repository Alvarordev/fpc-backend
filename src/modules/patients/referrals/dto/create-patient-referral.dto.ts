import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePatientReferralDto {
  @IsOptional() @IsUUID() followUpId?: string;
  @IsOptional() @IsUUID() fromHealthCenterId?: string;
  @IsUUID() toHealthCenterId!: string;
  @IsOptional() @IsString() @MaxLength(255) specialty?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsDateString() referralDate?: string;
  @IsOptional() @IsBoolean() hasReferralSheet?: boolean;
}
