import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
export class CreatePatientSisAffiliationDto {
  @IsUUID() followUpId!: string;
  @IsBoolean() canAffiliate!: boolean;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() cantAffiliateReason?: string;
  @IsOptional() @IsDateString() affiliatedAt?: string;
  @IsOptional() @IsString() comments?: string;
}
